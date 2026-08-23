import { useEffect } from 'react';

/**
 * useGlobalDragScroll
 * Permite deslizar/rolar qualquer tela, modal, relatório ou tabela tocando/arrastando
 * em qualquer lugar da tela em qualquer dispositivo (mobile, tablet, desktop, touch screens),
 * preservando toques normais em botões/links e permitindo navegação fluida.
 */
export function useGlobalDragScroll() {
    useEffect(() => {
        let isDown = false;
        let hasMoved = false;
        let startX = 0;
        let startY = 0;
        let initialScrollLeft = 0;
        let initialScrollTop = 0;
        let scrollTargetX: HTMLElement | null = null;
        let scrollTargetY: HTMLElement | null = null;
        let animationFrameId: number | null = null;
        let activePointerId: number | null = null;

        // Inércia cinética
        let lastTime = 0;
        let lastX = 0;
        let lastY = 0;
        let velocityX = 0;
        let velocityY = 0;

        const isFormInputElement = (el: HTMLElement | null): boolean => {
            if (!el) return false;
            const tag = el.tagName.toLowerCase();
            if (['input', 'textarea', 'select', 'option'].includes(tag)) return true;
            if (el.isContentEditable) return true;
            
            const interactiveParent = el.closest(
                'input, textarea, select, [contenteditable="true"], [role="slider"], [role="switch"], [data-no-drag-scroll]'
            );
            if (interactiveParent) return true;

            return false;
        };

        const findHorizontalScrollTarget = (startEl: HTMLElement | null): HTMLElement | null => {
            let current: HTMLElement | null = startEl;
            while (current && current !== document.body && current !== document.documentElement) {
                const style = window.getComputedStyle(current);
                const overflowX = style.overflowX;
                if ((overflowX === 'auto' || overflowX === 'scroll') && current.scrollWidth > current.clientWidth + 4) {
                    return current;
                }
                current = current.parentElement;
            }
            return null;
        };

        const findVerticalScrollTarget = (startEl: HTMLElement | null): HTMLElement | null => {
            let current: HTMLElement | null = startEl;
            while (current && current !== document.body && current !== document.documentElement) {
                const style = window.getComputedStyle(current);
                const overflowY = style.overflowY;
                if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight + 4) {
                    return current;
                }
                current = current.parentElement;
            }

            // Fallback para o container principal da aplicação
            const mainContainer = document.getElementById('main-scroll-container');
            if (mainContainer && (mainContainer.scrollHeight > mainContainer.clientHeight + 4 || mainContainer.scrollWidth > mainContainer.clientWidth + 4)) {
                return mainContainer;
            }

            // Fallback para scrollingElement do documento
            if (document.scrollingElement && document.scrollingElement.scrollHeight > window.innerHeight + 4) {
                return document.scrollingElement as HTMLElement;
            }

            return null;
        };

        const stopMomentum = () => {
            if (animationFrameId !== null) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
        };

        const handlePointerDown = (e: PointerEvent) => {
            // Em dispositivos touch (celulares/tablets), permitir 100% a rolagem nativa por toque ultra-fluida do navegador
            if (e.pointerType === 'touch' || e.pointerType === 'pen') return;

            // Para mouse/desktop, permitir arrastar para rolar
            if (e.button !== 0 || (e.isPrimary === false)) return;

            const target = e.target as HTMLElement | null;
            if (isFormInputElement(target)) return;

            const targetX = findHorizontalScrollTarget(target);
            const targetY = findVerticalScrollTarget(target);

            if (!targetX && !targetY) return;

            stopMomentum();

            isDown = true;
            hasMoved = false;
            activePointerId = e.pointerId;
            scrollTargetX = targetX;
            scrollTargetY = targetY;
            startX = e.clientX;
            startY = e.clientY;
            initialScrollLeft = targetX ? targetX.scrollLeft : 0;
            initialScrollTop = targetY ? targetY.scrollTop : 0;

            lastTime = performance.now();
            lastX = e.clientX;
            lastY = e.clientY;
            velocityX = 0;
            velocityY = 0;
        };

        const handlePointerMove = (e: PointerEvent) => {
            if (!isDown || activePointerId !== e.pointerId) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            if (!hasMoved) {
                // Threshold de 5px para distinguir clique/tap estático de arraste intencional
                if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                    hasMoved = true;
                    document.body.classList.add('select-none');
                }
            }

            if (hasMoved) {
                if (scrollTargetX) {
                    scrollTargetX.scrollLeft = initialScrollLeft - dx;
                }
                if (scrollTargetY) {
                    scrollTargetY.scrollTop = initialScrollTop - dy;
                }

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

        const handlePointerUp = (e: PointerEvent) => {
            if (!isDown || (activePointerId !== null && e.pointerId !== activePointerId)) return;
            isDown = false;
            activePointerId = null;
            document.body.classList.remove('select-none');

            if (hasMoved) {
                // Impede que o clique final ao soltar dispare botões ou links acidentalmente
                const captureClick = (clickEvent: MouseEvent) => {
                    clickEvent.stopPropagation();
                    clickEvent.preventDefault();
                    window.removeEventListener('click', captureClick, true);
                };
                window.addEventListener('click', captureClick, true);
                setTimeout(() => window.removeEventListener('click', captureClick, true), 120);

                // Aplica inércia cinética suave em ambos os eixos
                if ((scrollTargetX || scrollTargetY) && (Math.abs(velocityX) > 0.15 || Math.abs(velocityY) > 0.15)) {
                    let vx = velocityX * 16;
                    let vy = velocityY * 16;
                    const friction = 0.92;
                    const targetX = scrollTargetX;
                    const targetY = scrollTargetY;

                    const step = () => {
                        if (Math.abs(vx) < 0.5 && Math.abs(vy) < 0.5) {
                            animationFrameId = null;
                            return;
                        }
                        if (targetX) {
                            targetX.scrollLeft -= vx;
                        }
                        if (targetY) {
                            targetY.scrollTop -= vy;
                        }
                        vx *= friction;
                        vy *= friction;
                        animationFrameId = requestAnimationFrame(step);
                    };
                    animationFrameId = requestAnimationFrame(step);
                }
            }

            scrollTargetX = null;
            scrollTargetY = null;
        };

        const handlePointerCancel = () => {
            isDown = false;
            activePointerId = null;
            document.body.classList.remove('select-none');
            scrollTargetX = null;
            scrollTargetY = null;
        };

        window.addEventListener('pointerdown', handlePointerDown, { passive: true });
        window.addEventListener('pointermove', handlePointerMove, { passive: true });
        window.addEventListener('pointerup', handlePointerUp, { passive: true });
        window.addEventListener('pointercancel', handlePointerCancel, { passive: true });

        return () => {
            stopMomentum();
            window.removeEventListener('pointerdown', handlePointerDown);
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerCancel);
        };
    }, []);
}

