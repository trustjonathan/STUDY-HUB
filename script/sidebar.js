// FLEXIBLE SIDEBAR / HAMBURGER SCRIPT

document.addEventListener('DOMContentLoaded', () => {
  // Select hamburger button, sidebar menu, and overlay
  const menuBtn = document.querySelector('.home');
  const sideMenu = document.querySelector('#side-menu');
  const overlay = document.querySelector('#overlay');

  // Only initialize if all elements exist on this page
  if (!menuBtn || !sideMenu || !overlay) return;

  // Toggle sidebar on hamburger click
  menuBtn.addEventListener('click', () => {
    sideMenu.classList.toggle('active');
    overlay.classList.toggle('active');
    menuBtn.classList.toggle('active'); // animate hamburger
  });

  // Close sidebar when clicking overlay
  overlay.addEventListener('click', () => {
    sideMenu.classList.remove('active');
    overlay.classList.remove('active');
    menuBtn.classList.remove('active');
  });
});
