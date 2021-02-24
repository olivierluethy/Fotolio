//Search box
function triggercross(val) {
    var val = document.getElementById("search");
    var x = document.getElementById("closeid");
    x.style.display = "block";
}

function close1() {

    // document.getElementById("demo").innerHTML = "You wrote: " + val;
    var x = document.getElementById("closeid");
    if (x.style.display == "block") {
        x.style.display = "none";
    } else {
        x.style.display = "block";
    }
}

//Scrool down hide menu bar
var prevScrollpos = window.pageYOffset;
window.onscroll = function () {
    var currentScrollPos = window.pageYOffset;
    if (prevScrollpos > currentScrollPos) {
        document.getElementById("navigation").style.top = "0";
    } else {
        document.getElementById("navigation").style.top = "-50px";
    }
    prevScrollpos = currentScrollPos;
}

//Footer
var currentYear = new Date().getFullYear();
$(function () {
    $('#year').text(currentYear);
});