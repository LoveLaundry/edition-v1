import BillFooter from "./bill/BillFooter";
import BillHeader from "./bill/BillHeader";
import BillItemsTable from "./bill/BillItemsTable";
import BillSignAndIdentifications from "./bill/BillSignAndIdentifications";

const Bill=()=>{
    return(
        <div className="w-full h-full flex gap-4 flex-col justify-center items-center">
            <BillHeader/>
            <div className="w-full h-full flex justify-center items-center text-2xl font-bold">
                <BillItemsTable/>
            </div>
            <div className="w-full h-fit flex justify-center items-center text-2xl font-bold">
                <BillFooter/>
            </div>
            <div className="w-full h-fit text-xs font-bold flex justify-center items-center text-2xl font-bold">
                <BillSignAndIdentifications/>
            </div>
        </div> 
    )
}

export default Bill;