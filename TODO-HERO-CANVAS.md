# TODO - Hero animated pipeline background (canvas)

- [x] Update `public/index.html`
  - [x] Add hero background canvas behind existing hero content
  - [x] Add background floating stats elements (MQL + Optimal) in a background-only layer
  - [ ] Keep existing dashboard-preview markup as-is or remove per final integration decision


- [ ] Update `public/style.css`
  - [ ] Add CSS for `.hero` background canvas sizing/positioning/z-index
  - [ ] Add subtle bob animation for background stats

- [ ] Update `public/script.js`
  - [ ] Implement canvas renderer (curve draw + loop, gradient fill, traveling dot with glow/ring)
  - [ ] Add faint horizontal grid lines
  - [ ] Add resize handling
  - [ ] Ensure the existing page behaviors remain intact

- [ ] Visual verification
  - [ ] Confirm animation loops smoothly
  - [ ] Confirm readability of hero text
  - [ ] Confirm responsive scaling

