/* NAVBAR - SECTION */

const navSlide = () => {
    const burger = document.querySelector('.burger');
    const nav = document.querySelector('.nav-links');
    const navLinks = document.querySelectorAll('.nav-links li');
    //Toggle Nav
    burger.addEventListener('click', () => {
        nav.classList.toggle('nav-active');


        //Animate Links
        navLinks.forEach((link, index) => {
            if (link.style.animation) {
                link.style.animation = ''
            } else {
                link.style.animation = `navLinkFade 0.5s ease forwards ${index / 7 + 0.5}s`;
            }
        });

        //Burger Animation
        burger.classList.toggle('toggle');

    });

}

navSlide();


/* FOOTER SET YEAR - SECTION */

function setyear() {
    let currentYear = new Date().getFullYear();
    document.getElementById('year').innerHTML = '&copy; ' + currentYear + ' QUICK IMAGES. All rights Reserved.';
}

setyear();


/* MODAL IMAGE - SECTION */

// Get the modal
var modal = document.getElementById("myModal");

function openModalImage(imgId, src) {
    console.log('open');
    let img = document.getElementById(imgId);
    let modalImg = document.getElementById("modalImage");
    let captionText = document.getElementById("caption");
    modalImg.src = document.getElementById(imgId).src;
    captionText.innerHTML = document.getElementById(imgId).alt;

    document.getElementById('downloadImg').href = src;
    document.getElementById('downloadImg').download = src;

    document.getElementById('body').style.overflowY = "hidden";
    modal.style.display = "block";

    document.getElementById('goOut').style.display = "none";
}
// Get the <span> element that closes the modal
var span = document.getElementsByClassName("close")[0];
// When the user clicks on <span> (x), close the modal
span.onclick = function () {
    modal.style.display = "none";
    document.getElementById('body').style.overflowY = "auto";
    document.getElementById('goOut').style.display = "flex";
}

// Down scrool
window.addEventListener("scroll", function () {
    var header = document.querySelector("nav");
    header.classList.toggle("afterNav", window.scrollY > 5);
})