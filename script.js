/*
 * Sinkhorn visualisation script
 *
 * This file provides JavaScript functions to generate probability distributions,
 * compute the entropically regularised optimal transport plan via the Sinkhorn
 * algorithm, and update interactive Plotly charts. Each function is heavily
 * commented to aid understanding of the underlying mathematics.
 */

// Wait for the DOM to load before initialising the interface
document.addEventListener('DOMContentLoaded', function () {
    // Grab references to HTML elements
    const exampleSelect = document.getElementById('example-select');
    const paramsDiv = document.getElementById('params');
    const epsilonSlider = document.getElementById('epsilon-slider');
    const epsilonValueSpan = document.getElementById('epsilon-value');
    const costNumber = document.getElementById('cost-number');
    const epsilonExplanation = document.getElementById('epsilonExplanation');
    // Initialise parameters and charts
    buildParams(exampleSelect.value);
    // Update display when the example selection changes
    exampleSelect.addEventListener('change', () => {
        buildParams(exampleSelect.value);
        update();
    });
    // Update display when epsilon changes
    epsilonSlider.addEventListener('input', () => {
        epsilonValueSpan.textContent = parseFloat(epsilonSlider.value).toFixed(2);
        update();
    });
    // Build parameter fields depending on selected example
    function buildParams(example) {
        // Clear any existing parameters
        paramsDiv.innerHTML = '';
        // Helper to create labelled numeric inputs
        function addInput(label, id, defaultValue) {
            const wrapper = document.createElement('div');
            const lab = document.createElement('label');
            lab.textContent = label;
            lab.htmlFor = id;
            const inp = document.createElement('input');
            inp.type = 'number';
            inp.step = 'any';
            inp.id = id;
            inp.value = defaultValue;
            // Recompute when the value changes
            inp.addEventListener('input', () => update());
            wrapper.appendChild(lab);
            wrapper.appendChild(inp);
            paramsDiv.appendChild(wrapper);
        }
        // Create appropriate parameter inputs for each example
        switch (example) {
            case 'gaussian-gaussian':
                addInput('Mean of source (μₐ)', 'mu_a', 0);
                addInput('Std dev of source (σₐ)', 'sigma_a', 1);
                addInput('Mean of target (μᵦ)', 'mu_b', 2);
                addInput('Std dev of target (σᵦ)', 'sigma_b', 1);
                break;
            case 'gaussian-poisson':
                addInput('Mean of Gaussian (μₐ)', 'mu_a', 0);
                addInput('Std dev of Gaussian (σₐ)', 'sigma_a', 1);
                addInput('Poisson rate (λᵦ)', 'lambda_b', 3);
                break;
            case 'poisson-poisson':
                addInput('Poisson rate source (λₐ)', 'lambda_a', 3);
                addInput('Poisson rate target (λᵦ)', 'lambda_b', 5);
                break;
            case 'exponential-exponential':
                addInput('Rate of source (λₐ)', 'lambda_a', 1);
                addInput('Rate of target (λᵦ)', 'lambda_b', 2);
                break;
            case 'random-sum':
                addInput('Gaussian weight (w)', 'weight', 0.5);
                addInput('Gaussian mean (μ)', 'mu_mix', 1);
                addInput('Gaussian std dev (σ)', 'sigma_mix', 0.5);
                addInput('Exponential rate (λ)', 'lambda_mix', 1);
                break;
            case 'restaurant':
                addInput('Expected customers (λₐ)', 'lambda_a', 20);
                addInput('Expected customers after change (λᵦ)', 'lambda_b', 25);
                break;
            default:
                break;
        }
    }
    // Retrieve parameter values from input fields
    function getParams(example) {
        const params = {};
        const inputs = paramsDiv.querySelectorAll('input');
        inputs.forEach(inp => {
            params[inp.id] = parseFloat(inp.value);
        });
        return params;
    }
    // Generate distributions based on the selected example and parameters.
    // Returns an object {xA, a, xB, b} where xA and xB are arrays of support points
    // and a and b are arrays of probabilities.
    function generateDistributions(example, params) {
        let xA = [];
        let xB = [];
        let a = [];
        let b = [];
        // Helper to normalise an array so that it sums to 1
        function normalise(arr) {
            const sum = arr.reduce((acc, val) => acc + val, 0);
            return arr.map(val => val / sum);
        }
        // Gaussian probability density function
        function gaussianPdf(x, mu, sigma) {
            return Math.exp(-0.5 * Math.pow((x - mu) / sigma, 2)) / (sigma * Math.sqrt(2 * Math.PI));
        }
        // Poisson probability mass function (pmf)
        function poissonPmf(k, lambda) {
            // Compute λ^k e^{-λ} / k!
            let logP = k * Math.log(lambda) - lambda - logFactorial(k);
            return Math.exp(logP);
        }
        // Precompute factorials using logs to avoid overflow
        const logFactorialCache = {};
        function logFactorial(n) {
            if (logFactorialCache[n] !== undefined) return logFactorialCache[n];
            let sum = 0;
            for (let i = 2; i <= n; i++) {
                sum += Math.log(i);
            }
            logFactorialCache[n] = sum;
            return sum;
        }
        // Exponential density function
        function exponentialPdf(x, lambda) {
            return x >= 0 ? lambda * Math.exp(-lambda * x) : 0;
        }
        // Mixture distribution for random-sum example
        function mixturePdf(x, params) {
            const w = params.weight;
            const gauss = gaussianPdf(x, params.mu_mix, params.sigma_mix);
            const expo = exponentialPdf(x, params.lambda_mix);
            return w * gauss + (1 - w) * expo;
        }
        // Determine domain size and compute distributions
        switch (example) {
            case 'gaussian-gaussian': {
                const muA = params.mu_a;
                const sigmaA = Math.max(params.sigma_a, 1e-6);
                const muB = params.mu_b;
                const sigmaB = Math.max(params.sigma_b, 1e-6);
                // Determine a common support covering both Gaussians (±4 std dev)
                const minVal = Math.min(muA - 4 * sigmaA, muB - 4 * sigmaB);
                const maxVal = Math.max(muA + 4 * sigmaA, muB + 4 * sigmaB);
                const n = 50;
                const step = (maxVal - minVal) / (n - 1);
                for (let i = 0; i < n; i++) {
                    const x = minVal + i * step;
                    xA.push(x);
                    xB.push(x);
                    a.push(gaussianPdf(x, muA, sigmaA));
                    b.push(gaussianPdf(x, muB, sigmaB));
                }
                a = normalise(a);
                b = normalise(b);
                break;
            }
            case 'gaussian-poisson': {
                const muA = params.mu_a;
                const sigmaA = Math.max(params.sigma_a, 1e-6);
                const lambdaB = Math.max(params.lambda_b, 1e-6);
                // Determine Poisson support up to 6*λ to capture most mass
                const kMax = Math.ceil(lambdaB + 6 * Math.sqrt(lambdaB));
                const n = Math.max(kMax + 1, 20);
                for (let k = 0; k < n; k++) {
                    xA.push(k); // treat Gaussian on integer support for simplicity
                    xB.push(k);
                    a.push(gaussianPdf(k, muA, sigmaA));
                    b.push(poissonPmf(k, lambdaB));
                }
                a = normalise(a);
                b = normalise(b);
                break;
            }
            case 'poisson-poisson': {
                const lambdaA = Math.max(params.lambda_a, 1e-6);
                const lambdaB = Math.max(params.lambda_b, 1e-6);
                const maxK = Math.ceil(Math.max(lambdaA + 6 * Math.sqrt(lambdaA), lambdaB + 6 * Math.sqrt(lambdaB)));
                const n = Math.max(maxK + 1, 20);
                for (let k = 0; k < n; k++) {
                    xA.push(k);
                    xB.push(k);
                    a.push(poissonPmf(k, lambdaA));
                    b.push(poissonPmf(k, lambdaB));
                }
                a = normalise(a);
                b = normalise(b);
                break;
            }
            case 'exponential-exponential': {
                const lambdaA = Math.max(params.lambda_a, 1e-6);
                const lambdaB = Math.max(params.lambda_b, 1e-6);
                const maxVal = Math.max(5 / lambdaA, 5 / lambdaB);
                const n = 50;
                const step = maxVal / (n - 1);
                for (let i = 0; i < n; i++) {
                    const x = i * step;
                    xA.push(x);
                    xB.push(x);
                    a.push(exponentialPdf(x, lambdaA));
                    b.push(exponentialPdf(x, lambdaB));
                }
                a = normalise(a);
                b = normalise(b);
                break;
            }
            case 'random-sum': {
                // Use continuous support on [0, maxVal]
                const maxVal = 10; // fixed support for mixture example
                const n = 50;
                const step = maxVal / (n - 1);
                for (let i = 0; i < n; i++) {
                    const x = i * step;
                    xA.push(x);
                    xB.push(x);
                    const density = mixturePdf(x, params);
                    a.push(density);
                    // For the target distribution, shift the mean slightly
                    const shiftedDensity = mixturePdf(Math.max(x - 1, 0), params);
                    b.push(shiftedDensity);
                }
                a = normalise(a);
                b = normalise(b);
                break;
            }
            case 'restaurant': {
                // Model daily revenue as the number of customers (Poisson) multiplied by a unit price.
                // For simplicity, we treat revenue distribution as a Poisson with given mean.
                const lambdaA = Math.max(params.lambda_a, 1e-6);
                const lambdaB = Math.max(params.lambda_b, 1e-6);
                const maxK = Math.ceil(Math.max(lambdaA + 6 * Math.sqrt(lambdaA), lambdaB + 6 * Math.sqrt(lambdaB)));
                const n = Math.max(maxK + 1, 30);
                for (let k = 0; k < n; k++) {
                    // Revenue categories are integer numbers of “units”
                    xA.push(k);
                    xB.push(k);
                    a.push(poissonPmf(k, lambdaA));
                    b.push(poissonPmf(k, lambdaB));
                }
                a = normalise(a);
                b = normalise(b);
                break;
            }
            default:
                break;
        }
        return { xA, a, xB, b };
    }
    // Compute the cost matrix C_{ij} = |xA_i - xB_j|^2 (squared Euclidean distance)
    function computeCostMatrix(xA, xB) {
        const n = xA.length;
        const m = xB.length;
        const C = new Array(n);
        for (let i = 0; i < n; i++) {
            C[i] = new Array(m);
            for (let j = 0; j < m; j++) {
                const diff = xA[i] - xB[j];
                C[i][j] = diff * diff;
            }
        }
        return C;
    }
    // Run the Sinkhorn algorithm to compute the entropic transport plan
    // a, b: probability vectors of length n and m
    // C: cost matrix (n x m)
    // epsilon: regularisation parameter
    // Returns {P, cost} where P is the transport plan matrix and cost is \langle C,P \rangle
    function sinkhorn(a, b, C, epsilon, maxIter = 100, tol = 1e-7) {
        const n = a.length;
        const m = b.length;
        // Initialise u and v to ones
        let u = new Array(n).fill(1.0);
        let v = new Array(m).fill(1.0);
        // Precompute K = exp(-C/epsilon)
        const K = new Array(n);
        for (let i = 0; i < n; i++) {
            K[i] = new Array(m);
            for (let j = 0; j < m; j++) {
                K[i][j] = Math.exp(-C[i][j] / epsilon);
            }
        }
        // Iteratively update u and v
        for (let iter = 0; iter < maxIter; iter++) {
            // Compute K * v
            const Kv = new Array(n).fill(0);
            for (let i = 0; i < n; i++) {
                let sum = 0;
                for (let j = 0; j < m; j++) {
                    sum += K[i][j] * v[j];
                }
                Kv[i] = sum;
            }
            // Update u = a ./ (Kv)
            for (let i = 0; i < n; i++) {
                // Avoid division by zero by adding small epsilon
                u[i] = a[i] / Math.max(Kv[i], 1e-300);
            }
            // Compute K^T * u
            const KTu = new Array(m).fill(0);
            for (let j = 0; j < m; j++) {
                let sum = 0;
                for (let i = 0; i < n; i++) {
                    sum += K[i][j] * u[i];
                }
                KTu[j] = sum;
            }
            // Update v = b ./ (K^T u)
            let maxChange = 0;
            for (let j = 0; j < m; j++) {
                const newV = b[j] / Math.max(KTu[j], 1e-300);
                maxChange = Math.max(maxChange, Math.abs(newV - v[j]));
                v[j] = newV;
            }
            // Check for convergence; if changes are small break
            if (maxChange < tol) {
                break;
            }
        }
        // Compute transport plan P = diag(u) * K * diag(v)
        const P = new Array(n);
        for (let i = 0; i < n; i++) {
            P[i] = new Array(m);
            for (let j = 0; j < m; j++) {
                P[i][j] = u[i] * K[i][j] * v[j];
            }
        }
        // Compute transport cost \langle C, P \rangle = sum_{i,j} C_{ij} * P_{ij}
        let cost = 0;
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < m; j++) {
                cost += C[i][j] * P[i][j];
            }
        }
        return { P, cost };
    }
    // Update plots and transport plan
    function update() {
        const example = exampleSelect.value;
        const params = getParams(example);
        const epsilon = parseFloat(epsilonSlider.value);
        // Generate distributions
        const { xA, a, xB, b } = generateDistributions(example, params);
        // Compute cost matrix and transport plan
        const C = computeCostMatrix(xA, xB);
        const { P, cost } = sinkhorn(a, b, C, epsilon, 200);
        // Draw the bar charts for distributions a and b
        // Dark-theme palette
        const darkBg     = '#112240';
        const gridColor  = '#1e3a5f';
        const textColor  = '#8fa9c4';
        const titleColor = '#dce6f0';

        const commonAxis = {
            color: textColor,
            gridcolor: gridColor,
            zerolinecolor: gridColor,
            tickfont: { color: textColor, size: 11 }
        };
        const commonLayout = {
            paper_bgcolor: darkBg,
            plot_bgcolor:  darkBg,
            font: { color: textColor },
            margin: { t: 44, r: 16, l: 50, b: 44 }
        };

        const sourceData = [{
            x: xA,
            y: a,
            type: 'bar',
            marker: { color: '#4a9edd', opacity: 0.85 },
            hovertemplate: 'x=%{x}<br>a=%{y:.4f}<extra></extra>'
        }];
        const targetData = [{
            x: xB,
            y: b,
            type: 'bar',
            marker: { color: '#e8a020', opacity: 0.85 },
            hovertemplate: 'x=%{x}<br>b=%{y:.4f}<extra></extra>'
        }];
        const sourceLayout = Object.assign({}, commonLayout, {
            title: { text: 'Source distribution <i>a</i>', font: { color: titleColor, size: 14 } },
            xaxis: Object.assign({ title: { text: 'Support', font: { color: textColor } } }, commonAxis),
            yaxis: Object.assign({ title: { text: 'Probability', font: { color: textColor } } }, commonAxis)
        });
        const targetLayout = Object.assign({}, commonLayout, {
            title: { text: 'Target distribution <i>b</i>', font: { color: titleColor, size: 14 } },
            xaxis: Object.assign({ title: { text: 'Support', font: { color: textColor } } }, commonAxis),
            yaxis: Object.assign({ title: { text: 'Probability', font: { color: textColor } } }, commonAxis)
        });
        Plotly.newPlot('sourcePlot', sourceData, sourceLayout, { responsive: true });
        Plotly.newPlot('targetPlot', targetData, targetLayout, { responsive: true });
        // Prepare data for heatmap
        const heatmapData = [{
            z: P,
            x: xB,
            y: xA,
            type: 'heatmap',
            colorscale: 'Viridis',
            colorbar: { title: { text: 'P' }, thickness: 14, tickfont: { color: textColor } },
            hovertemplate: 'x=%{x}<br>y=%{y}<br>P=%{z:.4f}<extra></extra>'
        }];
        const heatmapLayout = Object.assign({}, commonLayout, {
            title: { text: 'Transport plan <i>P</i>', font: { color: titleColor, size: 14 } },
            xaxis: Object.assign({ title: { text: 'Target support', font: { color: textColor } } }, commonAxis),
            yaxis: Object.assign({ title: { text: 'Source support', font: { color: textColor } } }, commonAxis),
            margin: { t: 50, r: 24, l: 60, b: 60 }
        });
        Plotly.newPlot('heatmapPlot', heatmapData, heatmapLayout, { responsive: true });
        // Display cost
        costNumber.textContent = cost.toFixed(4);
        // Provide qualitative explanation of epsilon
        let explanation = '';
        if (epsilon > 2) {
            explanation = 'Large ε yields a diffuse coupling that is close to the independent product a⊗b.';
        } else if (epsilon < 0.1) {
            explanation = 'Small ε makes the coupling sharp and close to the unregularised optimal transport plan, but may cause numerical instability.';
        } else {
            explanation = 'Moderate ε balances smoothness with fidelity to the cost, producing a meaningful yet stable coupling.';
        }
        epsilonExplanation.textContent = explanation;
    }
    // Initial rendering
    epsilonValueSpan.textContent = parseFloat(epsilonSlider.value).toFixed(2);
    update();
});