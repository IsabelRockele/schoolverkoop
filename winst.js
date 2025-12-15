document.addEventListener("DOMContentLoaded", () => {
  const terugBtn = document.getElementById("terugNaarOverzicht");

  if (terugBtn) {
    terugBtn.addEventListener("click", () => {
      window.location.href = "school.html";
    });
  }
});
