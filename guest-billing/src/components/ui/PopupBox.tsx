const PopupBox=({children, onClose}:{children: React.ReactNode; onClose: () => void})=>{
    return(
        <div className="w-full h-full flex justify-center items-center bg-opacity-30 backdrop-blur-lg absolute top-0 left-0 animate-slideIn p-3">
            <div className="w-[94%] max-w-xl max-h-[92dvh] overflow-y-auto p-4 sm:p-8 flex flex-col justify-center items-center border-2 border-black bg-white rounded-lg shadow-lg backdrop-blur-lg relative">
                <div onClick={onClose} role="button" aria-label="Close" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }} className="absolute flex items-center justify-center top-2 right-2 cursor-pointer border-2 border-black rounded-full w-11 h-11 hover:bg-black hover:text-white transition-colors duration-300 shrink-0">
                    <span aria-hidden className="text-2xl leading-none font-bold">×</span>
                </div>
                {children}
            </div>
        </div>
    )
}

export default PopupBox;