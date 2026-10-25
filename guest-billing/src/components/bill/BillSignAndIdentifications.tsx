import { sampleBillInfo } from "../../data/constants";


const BillSignAndIdentifications = () => {
    return (
        <div className="w-full h-fit flex justify-between items-center gap-4">
            <div>
                <div>...................................</div>
                <div>Cashier Signature</div>
            </div>
            <div>
                <div className="relative">
                    ........................
                    <div className="absolute top-[-6px] left-[50%] transform -translate-x-1/2">
                        {sampleBillInfo.billId}
                    </div>
                </div>
                <div>Bill Number</div>
            </div>
            <div>
                <div className="relative">
                    ....................
                    <div className="absolute top-[-6px] left-[50%] transform -translate-x-1/2">
                        {sampleBillInfo.HotelGatePass}
                    </div>
                </div>
                <div>Gate Pass</div>
            </div>
            <div>
                <div>........................................</div>
                <div>Customer Signature</div>
            </div>
        </div>
    )
}

export default BillSignAndIdentifications;