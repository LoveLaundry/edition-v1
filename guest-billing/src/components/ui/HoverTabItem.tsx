const HoverTabItem=({tab}:{tab: string | null})=>{
    return(
        <div className="absolute select-none active:bg-blue-200 w-full flex items-center justify-center text-black h-full backdrop-blur-lg bg-white animate-slideIn">
            {tab}
        </div>
    )
}

export default HoverTabItem;