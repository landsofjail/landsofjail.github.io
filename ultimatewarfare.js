/* =========================================================
   ULTIMATE WARFARE GUIDE
   PAGE-SPECIFIC JAVASCRIPT
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       INITIALIZE
       ===================================================== */

    function initUltimateWarfare() {

        /*
         * IMPORTANT:
         * The actual HTML uses .uw-guide.
         */
        const guidePage =
            document.querySelector(".uw-guide");


        /*
         * If this is not the Ultimate Warfare page,
         * do nothing.
         *
         * This keeps the rest of the website untouched.
         */
        if (!guidePage) {
            return;
        }


        /* =================================================
           TABLE OF CONTENTS
           ================================================= */

        const navigationLinks =
            guidePage.querySelectorAll(
                '.uw-toc a[href^="#"]'
            );


        function getTarget(link) {

            const href =
                link.getAttribute("href");


            if (
                !href ||
                href === "#" ||
                href.charAt(0) !== "#"
            ) {
                return null;
            }


            const id =
                href.substring(1);


            return document.getElementById(id);

        }


        function scrollToTarget(target) {

            if (!target) {
                return;
            }


            /*
             * Space for the site's fixed header.
             */
            const headerOffset = 90;


            const targetPosition =
                target.getBoundingClientRect().top +
                window.pageYOffset -
                headerOffset;


            window.scrollTo({

                top: Math.max(
                    targetPosition,
                    0
                ),

                behavior: "smooth"

            });

        }


        navigationLinks.forEach(function (link) {

            link.addEventListener(
                "click",
                function (event) {

                    const target =
                        getTarget(link);


                    if (!target) {
                        return;
                    }


                    event.preventDefault();


                    scrollToTarget(target);


                    /*
                     * Keep the current page and only
                     * update the URL hash.
                     */
                    if (
                        window.history &&
                        window.history.pushState
                    ) {

                        window.history.pushState(
                            null,
                            "",
                            link.getAttribute("href")
                        );

                    }

                }
            );

        });


        /* =================================================
           TO THE TOP
           ================================================= */

        const topButton =
            document.getElementById(
                "uw-to-top"
            );


        if (topButton) {

            topButton.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();


                    window.scrollTo({

                        top: 0,

                        behavior: "smooth"

                    });

                }
            );

        }


        /* =================================================
           TO THE END
           ================================================= */

        const endButton =
            document.getElementById(
                "uw-to-end"
            );


        if (endButton) {

            endButton.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();


                    /*
                     * Prefer the actual footer.
                     */
                    const endTarget =
                        document.getElementById(
                            "uw-end"
                        );


                    if (endTarget) {

                        const targetPosition =
                            endTarget.getBoundingClientRect().top +
                            window.pageYOffset;


                        const finalPosition =
                            Math.max(
                                targetPosition -
                                window.innerHeight +
                                20,
                                0
                            );


                        window.scrollTo({

                            top: finalPosition,

                            behavior: "smooth"

                        });


                        return;

                    }


                    /*
                     * Fallback.
                     */
                    const documentHeight =
                        Math.max(
                            document.body.scrollHeight,
                            document.documentElement.scrollHeight
                        );


                    const maxScroll =
                        Math.max(
                            documentHeight -
                            window.innerHeight,
                            0
                        );


                    window.scrollTo({

                        top: maxScroll,

                        behavior: "smooth"

                    });

                }
            );

        }


        /* =================================================
           ACTIVE TOC ITEM
           ================================================= */

        const tocItems =
            Array.from(
                navigationLinks
            );


        const sectionItems = [];


        tocItems.forEach(function (link) {

            const target =
                getTarget(link);


            if (target) {

                sectionItems.push({

                    element: target,

                    link: link

                });

            }

        });


        function updateActiveTOC() {

            if (!sectionItems.length) {
                return;
            }


            const scrollPosition =
                window.pageYOffset + 130;


            let activeItem = null;


            sectionItems.forEach(
                function (item) {

                    const sectionPosition =
                        item.element.getBoundingClientRect().top +
                        window.pageYOffset;


                    if (
                        scrollPosition >=
                        sectionPosition
                    ) {

                        activeItem = item;

                    }

                }
            );


            tocItems.forEach(
                function (link) {

                    link.classList.remove(
                        "uw-active"
                    );

                }
            );


            if (activeItem) {

                activeItem.link.classList.add(
                    "uw-active"
                );

            }

        }


        window.addEventListener(
            "scroll",
            updateActiveTOC,
            {
                passive: true
            }
        );


        updateActiveTOC();


        /* =================================================
           DIRECT HASH NAVIGATION
           ================================================= */

        function handleHash() {

            const hash =
                window.location.hash;


            if (!hash) {
                return;
            }


            const id =
                decodeURIComponent(
                    hash.substring(1)
                );


            const target =
                document.getElementById(id);


            if (!target) {
                return;
            }


            setTimeout(
                function () {

                    scrollToTarget(
                        target
                    );

                },
                150
            );

        }


        handleHash();


        /* =================================================
           BROWSER BACK / FORWARD
           ================================================= */

        window.addEventListener(
            "popstate",
            function () {

                const hash =
                    window.location.hash;


                if (!hash) {
                    return;
                }


                const id =
                    decodeURIComponent(
                        hash.substring(1)
                    );


                const target =
                    document.getElementById(id);


                if (target) {

                    scrollToTarget(
                        target
                    );

                }

            }
        );


        /* =================================================
           MOBILE TABLE WRAPPER
           ================================================= */

        const tables =
            guidePage.querySelectorAll(
                "table"
            );


        tables.forEach(function (table) {

            const parent =
                table.parentElement;


            /*
             * Existing .uw-table-wrap already handles
             * the table, so do not create another wrapper.
             */
            if (
                parent &&
                (
                    parent.classList.contains(
                        "uw-table-wrap"
                    ) ||
                    parent.classList.contains(
                        "uw-table-scroll"
                    )
                )
            ) {
                return;
            }


            const wrapper =
                document.createElement(
                    "div"
                );


            wrapper.className =
                "uw-table-scroll";


            table.parentNode.insertBefore(
                wrapper,
                table
            );


            wrapper.appendChild(
                table
            );

        });


        /* =================================================
           ESCAPE KEY
           ================================================= */

        document.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key ===
                    "Escape"
                ) {

                    /*
                     * Reserved for future mobile
                     * navigation controls.
                     */

                }

            }
        );


        /* =================================================
           IMAGE FALLBACK
           ================================================= */

        const images =
            guidePage.querySelectorAll(
                "img"
            );


        images.forEach(function (image) {

            image.addEventListener(
                "error",
                function () {

                    image.classList.add(
                        "uw-image-error"
                    );

                },
                {
                    once: true
                }
            );

        });


        /* =================================================
           MARK JS AS READY
           ================================================= */

        guidePage.classList.add(
            "uw-js-ready"
        );


        /*
         * Debug marker.
         *
         * You will not normally notice this.
         * It simply confirms that this script
         * successfully initialized.
         */
        guidePage.setAttribute(
            "data-uw-js",
            "ready"
        );

    }


    /* =====================================================
       START
       ===================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initUltimateWarfare
        );

    } else {

        initUltimateWarfare();

    }

})();