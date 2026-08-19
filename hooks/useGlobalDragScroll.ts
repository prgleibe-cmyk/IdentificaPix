import { useEffect } from 'react';

/**
 * useGlobalDragScroll
 * Permite deslizar/rolar qualquer tela, modal ou tabela clicando e arrastando com o mouse
 * em qualquer lugar livre da tela (drag-to-scroll com inércia cinética), sem precisar mirar na barra lateral.
 */
export function useGlobalDragScroll() {
    useEffect(() => {
        let isDown = false;
        let hasMoved = false;
        let startX = 0;
        let startY = 0;
        let initialScrollLeft = 0;
        let initialScrollTop = 0;
        let scrollTarget: HTMLElement | null = null;
        let animationFrameId: number | null = null;

        // Inércia cinética
        let lastTime = 0;
        let lastX = 0;
        let lastY = 0;
        let velocityX = 0;
        let velocityY = 0;

        const isInteractiveElement = (el: HTMLElement | null): boolean => {
            if (!el) return false;
            const tag = el.tagName.toLowerCase();
            if (['input', 'textarea', 'select', 'option'].includes(tag)) return true;
            if (el.isContentEditable) return true;
            
            // Verifica se está dentro de campos de entrada ou controles especiais de formulário
            const interactiveParent = el.closest(
                'input, textarea, select, [contenteditable="true"], [role="slider"], [role="switch"], [data-no-drag-scroll]'
            );
            if (interactiveParent) return true;

            return false;
        };

        const findScrollableAncestor = (startEl: HTMLElement | null): HTMLElement | null => {
            let current: HTMLElement | null = startEl;
            while (current && current !== document.body && current !== document.documentElement) {
                const style = window.getComputedStyle(current);
                const overflowY = style.overflowY;
                const overflowX = style.overflowX;

                const isScrollableY = (overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight + 4;
                const isScrollableX = (overflowX === 'auto' || overflowX === 'scroll') && current.scrollWidth > current.clientWidth + 4;

                if (isScrollableY || isScrollableX) {
                    return current;
                }
                current = current.parentElement;
            }

            // Fallback para o container principal de scroll se existir e tiver conteúdo que permita rolar
            const mainContainer = document.getElementById('main-scroll-container');
            if (mainContainer && (mainContainer.scrollHeight > mainContainer.clientHeight + 4 || mainContainer.scrollWidth > mainContainer.clientWidth + 4)) {
                return mainContainer;
            }

            return null;
        };

        const stopMomentum = () => {
            if (animationFrameId !== null) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
        };

        const handleMouseDown = (e: MouseEvent) => {
            // Apenas clique com o botão esquerdo principal do mouse
            if (e.button !== 0) return;

            const target = e.target as HTMLElement | null;
            if (isInteractiveElement(target)) return;

            const scrollable = findScrollableAncestor(target);
            if (!scrollable) return;

            stopMomentum();

            isDown = true;
            hasMoved = false;
            scrollTarget = scrollable;
            startX = e.clientX;
            startY = e.clientY;
            initialScrollLeft = scrollable.scrollLeft;
            initialScrollTop = scrollable.scrollTop;

            lastTime = performance.now();
            lastX = e.clientX;
            lastY = e.clientY;
            velocityX = 0;
            velocityY = 0;
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!isDown || !scrollTarget) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            if (!hasMoved) {
                // Threshold de 4px para distinguir clique intencional de início de arrasto
                if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
                    hasMoved = true;
                    document.body.classList.add('select-none');
                }
            }

            if (hasMoved) {
                scrollTarget.scrollLeft = initialScrollLeft - dx;
                scrollTarget.scrollTop = initialScrollTop - dy;

                const now = performance.now();
                const dt = Math.max(1, now - lastTime);
                const instantVx = (e.clientX - lastX) / dt;
                const instantVy = (e.clientY - lastY) / dt;
                velocityX = velocityX * 0.4 + instantVx * 0.6;
                velocityY = velocityY * 0.4 + instantVy * 0.6;

                lastTime = now;
                lastX = e.clientX;
                lastY = e.clientY;
            }
        };

        const handleMouseUp = () => {
            if (!isDown) return;
            isDown = false;
            document.body.classList.remove('select-none');

            if (hasMoved) {
                // Previne que o clique acidental ao soltar o mouse dispare eventos em botões/cards
                const captureClick = (clickEvent: MouseEvent) => {
                    clickEvent.stopPropagation();
                    clickEvent.preventDefault();
                    window.removeEventListener('click', captureClick, true);
                };
                window.addEventListener('click', captureClick, true);
                setTimeout(() => window.removeEventListener('click', captureClick, true), 100);

                // Aplica inércia suave ao soltar o arrasto
                if (scrollTarget && (Math.abs(velocityX) > 0.15 || Math.abs(velocityY) > 0.15)) {
                    let vx = velocityX * 16;
                    let vy = velocityY * 16;
                    const friction = 0.92;
                    const target = scrollTarget;

                    const step = () => {
                        if (Math.abs(vx) < 0.5 && Math.abs(vy) < 0.5) {
                            animationFrameId = null;
                            return;
                        }
                        if (target) {
                            target.scrollLeft -= vx;
                            target.scrollTop -= vy;
                        }
                        vx *= friction;
                        vy *= friction;
                        animationFrameId = requestAnimationFrame(step);
                    };
                    animationFrameId = requestAnimationFrame(step);
                }
            }

            scrollTarget = null;
        };

        window.addEventListener('mousedown', handleMouseDown, { passive: true });
        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        window.addEventListener('mouseup', handleMouseUp, { passive: true });

        return () => {
            stopMomentum();
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);
}
