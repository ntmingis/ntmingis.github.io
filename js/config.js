/*
 * PROFILE: the only file you normally need to edit.
 *
 * Leave a field as "" to hide it. Buttons for empty or invalid values are
 * removed automatically, so no dead or fake links ever ship.
 *   - URLs must start with https:// (and use the right host: linkedin.com, github.com ...)
 *   - cv can be a relative path to a PDF in this repo, e.g. "assets/cv.pdf"
 */
window.PROFILE = {
  name: "Nguyễn Tuấn Minh",

  email: "nguyenminh2211204@gmail.com",
  linkedin: "",        // TODO: "https://www.linkedin.com/in/<handle>"
  github: "https://github.com/ntmingis",
  cv: "",              // "assets/cv.pdf" or an https:// link

  projectRepo: "",     // public repo for the Falco + auditd lab, once sanitized and published

  // Only credentials you can verify. Each needs name, issuer and an https verifyUrl
  // from the issuer (Credly, Coursera, Cisco NetAcad ...); the section stays hidden otherwise.
  // { name: "", issuer: "", date: "2026-01", verifyUrl: "https://..." }
  certifications: [],

  facebook: "https://www.facebook.com/ntming24/",
  instagram: "https://www.instagram.com/tnmingis/",
};
