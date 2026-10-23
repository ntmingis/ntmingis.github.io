/*
 * PROFILE — the only file you normally need to edit.
 *
 * Leave a field as "" to hide it. Buttons and lines for empty or invalid
 * values are removed automatically, so no fake links ever ship.
 *   - URLs must start with https://
 *   - cv can be a relative path to a PDF in this repo, e.g. "assets/cv.pdf"
 */
window.PROFILE = {
  name: "Nguyễn Tuấn Minh", // shown in the intro scene and the tab title
  university: "",      // shown in the profile text already; set to also show the line
  major: "",           // e.g. "Information Security"
  location: "",        // optional, e.g. "Ho Chi Minh City, Vietnam"

  email: "",           // professional email
  github: "https://github.com/ntmingis", // owner of ntmingis/portfolio-tm (this site)
  linkedin: "",        // https://www.linkedin.com/in/<handle>
  cv: "",              // "assets/cv.pdf" or an https:// link

  projectRepo: "",     // public repo for the IAM302 lab, if you ever publish one

  // Only credentials you can verify. Each needs name, issuer and an https verifyUrl
  // from the issuer (Credly, Coursera, Cisco NetAcad ...); the section stays hidden otherwise.
  // { name: "", issuer: "", date: "2026-01", verifyUrl: "https://..." }
  certifications: [],

  facebook: "https://www.facebook.com/ntming24/",
  instagram: "https://www.instagram.com/tnmingis/",
};
