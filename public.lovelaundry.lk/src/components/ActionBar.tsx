import type { ActionType } from "../types/action";
import Action from "./Action";

interface ActionBarProps {
    items: ActionType[];
    selectedItem: ActionType | null;
    setSelectedItem: (item: ActionType) => void;
}

const ActionBar = ({
    items,
    selectedItem,
    setSelectedItem,
}: ActionBarProps) => {
    return (
        <nav
            className="
                hidden
                fixed
                bottom-5
                left-1/2
                z-50
                w-[calc(100%-24px)]
                max-w-[520px]
                -translate-x-1/2
            "
        >
            <div
                className="
                    relative
                    flex
                    min-h-[68px]
                    items-center
                    justify-center
                    gap-1
                    rounded-[18px]
                    border
                    border-red-600
                    bg-surface
                    px-2
                    py-2
                    shadow-[0_10px_35px_rgba(var(--shadow-rgb),0.5)]
                    sm:gap-2
                    sm:px-3
                "
            >
                {items.map((item) => (
                    <Action
                        key={item.id}
                        item={item}
                        isSelected={selectedItem?.id === item.id}
                        setSelected={setSelectedItem}
                    />
                ))}
            </div>
        </nav>
    );
};

export default ActionBar;