import { sampleBillInfo } from "../../data/constants";
import { calculateBillTotals } from "../../data/billTotals.js";

const BillItemsTable=()=>{
    const totals = calculateBillTotals(sampleBillInfo.items);

    return(
        <div className="w-full overflow-x-auto">
        <div className="text-sm min-w-[540px] w-full h-full">
            <div className="flex flex-row items-center justify-center w-full">
                <div className="border w-full text-center h-[22px]">Description of Item</div>
                <div className="border w-20 text-center h-[22px]">QTY</div>
                <div className="border w-24 text-center h-[22px]">Rate</div>
                <div className="border w-36 text-center h-[22px]">Amount</div>
                <div className="border w-16 text-center h-[22px]">CTs.</div>
            </div>
            <div>
                {
                    sampleBillInfo.items.map((item, index) => (
                        <BillItem key={index} index={index} description={item.itemName} qty={item.quantity} rate={item.price} />
                    ))
                }
                {
                    sampleBillInfo.items.length<15 && Array(15-sampleBillInfo.items.length).fill(0).map((_,index) =>(
                        <BillItem key={sampleBillInfo.items.length + index} index={sampleBillInfo.items.length + index} description={''} qty={null} rate={null} />
                    ))
                }
            </div>
            <div>
                <TotalRow totalQTY={totals.quantity} totalAmount={totals.amountCents / 100} totalCents={0} />
            </div>
        </div>
        </div>
    )
}

export default BillItemsTable;

const BillItem=({ index, description, qty, rate }: { index: number; description: string | null; qty: number | null; rate: number | null })=>{
    return(
        <div className="flex flex-row items-center justify-center w-full">
            <div className="w-full border h-[22px]"><span className="px-2">{index + 1}.</span> {description}</div>
            <div className="w-20 text-center border h-[22px]">{qty || null}</div>
            <div className="w-24 text-center border h-[22px]">{rate || null}</div>
            <div className="w-36 text-center border h-[22px]">{qty && rate ? (qty * rate).toFixed(2) : null}</div>
            <div className="w-16 text-center border h-[22px]">{qty && rate ? (((qty * rate) % 1 * 100).toString()+"00").slice(0, 2) : null}</div>
        </div>
    )
}

const TotalRow=({ totalQTY, totalAmount, totalCents }: { totalQTY: number; totalAmount: number; totalCents: number })=>{
    return(
        <div className="flex flex-row items-center justify-center w-full font-bold">
            <div className="w-full text-right flex justify-end items-center">
                <div className="font-bold border w-fit px-4">Total:</div>
            </div>
            <div className="w-20 text-center border h-[22px]">{totalQTY}</div>
            <div className="w-24 text-center border h-[22px]"></div>
            <div className="w-36 text-center border h-[22px]">{totalAmount.toFixed(2)}</div>
            <div className="w-16 text-center border h-[22px]">{totalCents.toString().padStart(2, '0')}</div>
        </div>
    )
}
