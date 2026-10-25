import BillHeaderForm from "./BillHeaderForm";

const BillHeader=()=>{
    return(
        <div className="w-full h-fit flex flex-col gap-2 justify-center items-center text-2xl font-bold">
            <div className="w-full h-fit flex items-center gap-2">
                <div className="flex flex-col justify-between items-center shrink-0">
                    <img src="/icon.png" alt="Logo" className="h-14 w-20 sm:h-20 sm:w-28" />
                    <div className="text-center text-xs font-pacifico">Love Laundry</div>
                </div>
                <div className="text-center w-full text-xl sm:text-3xl">Love Laundry <br></br> and dry cleaning experts</div>
            </div>
            <ul className="list-disc list-inside pl-0 w-full h-fit flex flex-wrap justify-center items-center gap-1 text-xs">
                <div className="w-full h-fit flex justify-between items-center gap-4">
                    <li>Dry Cleaning</li>
                    <li>Free Pickup & Delivery</li>
                    <li>Wash & Pressed</li>
                </div>
                <div className="w-full h-fit flex justify-center items-center gap-4">
                    <li>Wash & Fold</li>
                    <li>Laundered Pressed</li>
                </div>
            </ul>
            <div className="w-full h-fit flex flex-wrap justify-between items-center text-xs gap-x-4 gap-y-1">
                <div>
                    <div>
                        Tel: +94 77 4200 919 / 070 243 3566
                    </div>
                    <div>Email: lovelaundry01@gmail.com</div>
                </div>
                <div>
                    Kuda bingiriya, Panirendawa.
                </div>
            </div>
            <BillHeaderForm/>
        </div>
    )
}

export default BillHeader;