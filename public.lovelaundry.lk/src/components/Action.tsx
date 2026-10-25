import { motion } from "framer-motion";
import type { ActionType } from "../types/action";

interface ActionProps {
    item: ActionType;
    isSelected: boolean;
    setSelected: (item: ActionType) => void;
}

const Action = ({
    item,
    isSelected,
    setSelected,
}: ActionProps) => {
    const Icon = item.icon;
    const isPrimary = item.id === "add";

    return (
        <motion.button
            type="button"
            onClick={() => setSelected(item)}
            aria-label={item.label}
            aria-pressed={isSelected}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.93 }}
            transition={{
                type: "spring",
                stiffness: 400,
                damping: 20,
            }}
            className={`
                group
                relative
                flex
                items-center
                justify-center
                rounded-[14px]
                outline-none
                transition-all
                duration-200
                focus-visible:ring-2
                focus-visible:ring-brand
                focus-visible:ring-offset-2

                ${isPrimary
                    ? `
                            h-[56px]
                            w-[56px]
                            rounded-[15px]
                            bg-brand
                            text-on-dark
                            shadow-[0_7px_20px_rgba(var(--brand-rgb),0.3)]
                        `
                    : `
                            h-[52px]
                            min-w-[52px]
                            ${isSelected
                        ? `
                                        bg-brand
                                        text-on-dark
                                        shadow-[0_6px_18px_rgba(var(--brand-rgb),0.28)]
                                    `
                        : `
                                        text-faint
                                        hover:bg-brand-soft
                                        hover:text-brand
                                    `
                    }
                        `
                }
            `}
        >
            <motion.span
                animate={{
                    scale: isSelected || isPrimary ? 1.08 : 1,
                }}
                className="relative z-10 flex items-center justify-center"
            >
                <Icon
                    className={
                        isPrimary
                            ? "h-6 w-6"
                            : "h-[22px] w-[22px]"
                    }
                />
            </motion.span>

            <span
                className="
                    pointer-events-none
                    absolute
                    -bottom-[34px]
                    left-1/2
                    z-50
                    -translate-x-1/2
                    whitespace-nowrap
                    rounded-md
                    bg-ink
                    px-2.5
                    py-1.5
                    text-[10px]
                    font-semibold
                    tracking-wide
                    text-on-dark
                    opacity-0
                    shadow-lg
                    transition-opacity
                    duration-200
                    group-hover:opacity-100
                    sm:block
                "
            >
                {item.label}
            </span>
        </motion.button>
    );
};

export default Action;