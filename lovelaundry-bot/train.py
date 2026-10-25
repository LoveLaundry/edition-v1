import argparse
import json
import os

from datasets import Dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments,
)
from peft import LoraConfig, get_peft_model, PeftModel
from trl import SFTTrainer


def load_rows(path):
    rows = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="data/knowledge_dataset.jsonl")
    parser.add_argument("--base-model", default="TinyLlama/TinyLlama-1.1B-Chat-v1.0")
    parser.add_argument("--output-dir", default="lovelaundry-model")
    parser.add_argument("--epochs", type=int, default=6)
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--max-seq-length", type=int, default=1024)
    parser.add_argument("--learning-rate", type=float, default=2e-4)
    args = parser.parse_args()

    rows = load_rows(args.data)
    dataset = Dataset.from_list(rows)

    tokenizer = AutoTokenizer.from_pretrained(args.base_model)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype="bfloat16",
        bnb_4bit_use_double_quant=True,
    )

    model = AutoModelForCausalLM.from_pretrained(
        args.base_model,
        quantization_config=bnb_config,
        device_map="auto",
    )

    model = get_peft_model(
        model,
        LoraConfig(
            r=16,
            lora_alpha=32,
            lora_dropout=0.05,
            target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
            bias="none",
            task_type="CAUSAL_LM",
        ),
    )

    def format_example(example):
        text = tokenizer.apply_chat_template(
            example["messages"], tokenize=False, add_generation_prompt=False
        )
        return {"text": text}

    dataset = dataset.map(format_example)

    training_args = TrainingArguments(
        output_dir=args.output_dir,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=4,
        learning_rate=args.learning_rate,
        fp16=False,
        bf16=True,
        logging_steps=5,
        save_strategy="epoch",
        optim="paged_adamw_8bit",
        report_to="none",
    )

    trainer = SFTTrainer(
        model=model,
        args=training_args,
        train_dataset=dataset,
        tokenizer=tokenizer,
        max_seq_length=args.max_seq_length,
    )

    trainer.train()
    trainer.save_model(args.output_dir)

    model = model.merge_and_unload()
    merged_dir = args.output_dir + "-merged"
    model.save_pretrained(merged_dir)
    tokenizer.save_pretrained(merged_dir)
    print(f"Saved merged model to {merged_dir}")

    gguf_path = os.path.join(merged_dir, "lovelaundry.gguf")
    print("To serve with Ollama: convert to GGUF and run `ollama create lovelaundry -f Modelfile`")
    print(f"  python -m llama.cpp.convert --outfile {gguf_path} {merged_dir}")


if __name__ == "__main__":
    main()
