const smokePlumes = document.querySelectorAll('.smoke-plume');

function updateSmokePlumes(event) {
  smokePlumes.forEach(plume => {
    const rect = plume.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    plume.style.setProperty('--mouse-x', `${x}px`);
    plume.style.setProperty('--mouse-y', `${y}px`);
  });
}

document.addEventListener('mousemove', updateSmokePlumes);

document.addEventListener('mouseleave', () => {
  smokePlumes.forEach(plume => {
    plume.style.setProperty('--mouse-x', '50%');
    plume.style.setProperty('--mouse-y', '50%');
  });
});
