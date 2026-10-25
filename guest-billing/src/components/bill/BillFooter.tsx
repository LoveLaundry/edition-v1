import { conditions } from "../../data/constants";

const BillFooter=()=>{
    return(
        <div className="flex flex-col items-center justify-center w-full h-fit">
            <div className="text-sm font-extrabold text-left w-full">CONDITIONS:</div>
            <div>
                {
                    conditions.map((condition, index) => (
                        <div key={index} className="text-xs">{condition}</div>
                    ))
                }
            </div>
        </div>
    )
}   

export default BillFooter;