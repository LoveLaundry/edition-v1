import { sampleBillInfo } from "../../data/constants";

const BillHeaderForm = () => {
    return (
        <div className="w-full flex flex-col sm:flex-row gap-4 sm:gap-10 items-stretch sm:items-center justify-between">
            <div className="text-sm w-full">
                <div className="flex w-full">
                    <span className="relative">Name:</span>
                    <div className="relative"> 
                        <div className="absolute text-nowrap bottom-1 left-1">{sampleBillInfo.name}</div>
                        <div className="absolute left-0 bottom-0">..........................................................</div>
                    </div>
                </div>
                <div className="flex w-full">
                    <span className="relative">Address:</span>
                    <div className="relative"> 
                        <div className="absolute text-nowrap bottom-1 left-1">{sampleBillInfo.address}</div>
                        <div className="absolute left-0 bottom-0">......................................................</div>
                    </div>
                </div>
                <div className="flex w-full">
                    <span className="relative">Contact No:</span>
                    <div className="relative"> 
                        <div className="absolute text-nowrap bottom-1 left-1">{sampleBillInfo.contactNumber}</div>
                        <div className="absolute left-0 bottom-0">................................................</div>
                    </div>
                </div>
            </div>

            <div className="w-full sm:w-80 h-full text-xs">
                <div className="border h-full grid grid-rows-2">
                    <div className="flex w-full">
                        <div className="w-24 border flex items-center justify-center">
                            Received
                        </div>
                        <div className="w-full grid grid-rows-2">
                            <div className="border flex items-center justify-center">{sampleBillInfo.receiptDate}</div>
                            <div className="border flex items-center justify-center"></div>
                        </div>
                    </div>
                    <div className="flex w-full ">
                        <div className="w-24 border flex items-center justify-center">
                            Delivery
                        </div>
                        <div className="w-full grid grid-rows-2">
                            <div className="border flex items-center justify-center">{sampleBillInfo.deliveredDate}</div>
                            <div className="border flex items-center justify-center"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default BillHeaderForm;