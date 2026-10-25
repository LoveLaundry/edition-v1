import { useLayoutEffect, useRef } from "react";
import { gsap } from "../lib/gsap";

interface RevealOptions {
    y?: number;
    x?: number;
    scale?: number;
    duration?: number;
    delay?: number;
    stagger?: number;
    start?: string;
    once?: boolean;
    ease?: string;
}

/**
 * Scroll-triggered reveal animation.
 *
 * When attached to an element that itself carries the `data-reveal`
 * attribute, only that element animates. When attached to a container,
 * every direct/descendant element with a `data-reveal` attribute is
 * animated with a stagger.
 */
export const useReveal = <T extends HTMLElement>(
    options: RevealOptions = {}
) => {
    const {
        y = 32,
        x = 0,
        scale = 1,
        duration = 0.7,
        delay = 0,
        stagger = 0.1,
        start = "top 82%",
        once = true,
        ease = "power3.out",
    } = options;

    const ref = useRef<T>(null);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;

        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            return;
        }

        const self =
            el.hasAttribute("data-reveal") &&
            el.getAttribute("data-reveal") !== "";

        const targets = self
            ? [el]
            : Array.from(
                  el.querySelectorAll<HTMLElement>("[data-reveal]")
              );

        if (!targets.length) return;

        const ctx = gsap.context(() => {
            gsap.fromTo(
                targets,
                {
                    y,
                    x,
                    scale,
                    opacity: 0,
                },
                {
                    y: 0,
                    x: 0,
                    scale: 1,
                    opacity: 1,
                    duration,
                    delay,
                    stagger: targets.length > 1 ? stagger : 0,
                    ease,
                    scrollTrigger: {
                        trigger: el,
                        start,
                        once,
                    },
                }
            );
        }, el);

        return () => ctx.revert();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return ref;
};
