# Computational Optimal Transport & Sinkhorn Algorithm

An interactive web visualisation for exploring entropic optimal transport and the Sinkhorn algorithm, built as a Final Year Project (2026).

## 🌐 Live Demo

Deploy to GitHub Pages — see setup instructions below.

## 📖 Overview

This site explains and demonstrates:

- **Kantorovich Optimal Transport** – minimising a transport cost over couplings
- **Entropic Regularisation** – smoothing the OT problem with a Shannon entropy penalty
- **Sinkhorn Algorithm** – an efficient iterative solver via row/column normalisation

The interactive visualisation lets you choose from six distribution pairs, tune parameters, and watch the transport plan heatmap update in real time.

## 🗂️ Project Structure

```
optimal-transport-site/
├── index.html          # Home / introduction
├── theory.html         # Mathematical background
├── couplings.html      # Description of distribution examples
├── sinkhorn.html       # Interactive visualisation
├── style.css           # Shared stylesheet
├── script.js           # Distribution generation + Sinkhorn solver
└── README.md           # This file
```

## 🚀 Running Locally

Simply open `index.html` in any modern browser — no build step or server required. All dependencies (Plotly, MathJax) are loaded from CDN.

## 🌍 Deploying to GitHub Pages

1. Fork or push this repository to GitHub.
2. Go to **Settings → Pages**.
3. Set **Source** to `Deploy from a branch`, choose `main` (or `master`), and select `/ (root)`.
4. Click **Save**. Your site will be live at `https://<your-username>.github.io/<repo-name>/`.

## 📦 Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| [Plotly.js](https://plotly.com/javascript/) | 2.24.1 | Interactive charts and heatmaps |
| [MathJax](https://www.mathjax.org/) | 3 | LaTeX equation rendering |

No npm install needed — all loaded via CDN.

## 📐 Distribution Examples

| Name | Description |
|------|-------------|
| Gaussian vs Gaussian | Two normal distributions with adjustable means and std devs |
| Gaussian vs Poisson | Mixed continuous/discrete transport |
| Poisson vs Poisson | Discrete-to-discrete on integer support |
| Exponential vs Exponential | Positive-support distributions |
| Random Sum | Gaussian–Exponential mixture |
| Restaurant Revenue | Applied example: daily revenue under two pricing strategies |

## 📜 Licence

MIT — free to use and adapt with attribution.
