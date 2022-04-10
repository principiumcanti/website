const nav = document.querySelector('nav');
const navLinkList = document.querySelectorAll('.nav-link');
let oldPosition = 0;

function isInViewport(element) {
  const rect = element.getBoundingClientRect();

  return rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth);
}

function setActiveIfInViewport(queryselectorOfElementInViewport, queryselectorOfNavLink) {
  if (isInViewport(document.querySelector(queryselectorOfElementInViewport))) {
    navLinkList.forEach(navLink => navLink.classList.remove('active'));
    document.querySelector(queryselectorOfNavLink).classList.add('active')
  }
}

function registerSetFirstNavigationItemOnLoad(firstNavigationNameSlug) {
  window.addEventListener('load', function (e) {
    setActiveIfInViewport('#nav-'+firstNavigationNameSlug, '#nav-link-'+firstNavigationNameSlug);
  })
}

function registerSetNavigationOnScroll(navigationNameSlugList) {
  window.addEventListener('scroll', function (e) {
    if (window.scrollY > 50) {
      nav.classList.add('bg-white', 'shadow');
    } else{
      nav.classList.remove('bg-white', 'shadow');
    }
    if (window.scrollY - oldPosition > 0) {
      for (const navigationNameSlug of navigationNameSlugList) {
        setActiveIfInViewport('#nav-'+navigationNameSlug, '#nav-link-'+navigationNameSlug);
      }
    } else {
      for (const navigationNameSlug of navigationNameSlugList.reverse()) {
        setActiveIfInViewport('#nav-'+navigationNameSlug, '#nav-link-'+navigationNameSlug);
      }
    }
    oldPosition = window.scrollY;
  });
}

document.addEventListener('show.bs.collapse', function (e){
  nav.classList.add('bg-white', 'shadow');
});

document.addEventListener('hidden.bs.collapse', function (e){
  if(window.scrollY <= 50 ) {
    nav.classList.remove('bg-white', 'shadow');
  }
});