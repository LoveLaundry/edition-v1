import { useEffect, useState } from "react";
import Logo from "./ui/Logo";

const Header=()=>{
    const [comfort, setComfort] = useState(() => {
        try {
            return localStorage.getItem('gb-comfort') === 'on';
        } catch {
            return false;
        }
    });

    useEffect(() => {
        const root = document.getElementById('root');
        if (root) {
            (root.style as any).zoom = comfort ? '1.3' : '';
        }
        try {
            localStorage.setItem('gb-comfort', comfort ? 'on' : 'off');
        } catch {
            /* storage unavailable — comfort still applies for this visit */
        }
    }, [comfort]);

    return(
        <div className="w-full min-h-32 py-4 flex justify-center items-center gap-4 sm:gap-8 relative px-4">
            <Logo/>
            <div className="flex flex-col justify-center items-center gap-4 min-w-0">
                <div className="text-3xl sm:text-4xl text-red-600 font-bold font-pacifico text-center">Love Laundry</div>
                <div className="text-sm font-medium border py-1 px-3 rounded-2xl bg-black text-white text-center">Guest Laundry Accounts</div>
            </div>
            <button
                type="button"
                onClick={() => setComfort(v => !v)}
                aria-pressed={comfort}
                aria-label={comfort ? 'Comfort text size on — tap for normal size' : 'Comfort text size off — tap for largest text'}
                title={comfort ? 'Comfort text: on' : 'Comfort text: off'}
                className={`absolute right-3 top-3 min-w-11 min-h-11 px-3 rounded-full border-2 font-bold cursor-pointer transition-colors ${
                    comfort ? 'bg-black text-white border-black' : 'bg-white text-black border-black hover:bg-black hover:text-white'
                }`}
            >
                Aa
            </button>
        </div>
    )
}

export default Header;