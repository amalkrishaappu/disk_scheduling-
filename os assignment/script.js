// Available CPU scheduling algorithms
const algorithms = [
    {
        id: "fcfs",
        name: "FCFS",
        priority: false
    },
    {
        id: "priority-pre",
        name: "Priority (Preemptive)",
        priority: true
    },
    {
        id: "priority-non",
        name: "Priority (Non-Preemptive)",
        priority: true
    },
    {
        id: "rr",
        name: "Round Robin",
        priority: false
    },
    {
        id: "sjf-pre",
        name: "SJF (Preemptive / SRTF)",
        priority: false
    },
    {
        id: "sjf-non",
        name: "SJF (Non-Preemptive)",
        priority: false
    }
];

// Default process data
const initial = [
    { id: "P1", a: 0, b: 5, pri: 2, c: "#60a5fa" },
    { id: "P2", a: 1, b: 3, pri: 1, c: "#fb923c" },
    { id: "P3", a: 2, b: 4, pri: 3, c: "#6ee7b7" },
    { id: "P4", a: 3, b: 2, pri: 4, c: "#c4b5fd" }
];

let processes = initial.map(p => ({ ...p }));
let selected = "fcfs";
let animationTimer = null;
let activeRun = 0;
let animationPaused = false;

// Set up the page
function init() {
    document.getElementById("algorithm").innerHTML =
        algorithms.map(a =>
            `<option value="${a.id}">${a.name}</option>`
        ).join("");

    document.getElementById("algoTabs").innerHTML =
        algorithms.map(a =>
            `<button class="tab ${a.id === selected ? "active" : ""}"
                onclick="changeAlgorithm('${a.id}')">${a.name}</button>`
        ).join("");

    renderInputs();
    changeAlgorithm(selected);
}

// Change selected algorithm and explain it
function changeAlgorithm(id) {
    selected = id;
    document.getElementById("algorithm").value = id;

    renderInputs();

    document.querySelectorAll(".tab").forEach((button, index) => {
        button.classList.toggle("active", algorithms[index].id === id);
    });

    document.getElementById("settings").innerHTML =
        id === "rr"
            ? `<div class="field">
                    <label for="quantum">TIME QUANTUM (ms)</label>
                    <input id="quantum" type="number" min="1" value="2">
               </div>`
            : `<p class="muted">Time quantum is used only for Round Robin.</p>`;

    const explanations = {
        fcfs: "Processes run in order of arrival. Once a process starts, it runs until completion.",

        "priority-pre": "The ready process with the highest priority (smallest priority number) runs. A newly arrived higher-priority process can preempt it.",

        "priority-non": "When the CPU becomes free, choose the ready process with the highest priority. It runs until completion.",

        rr: "Each ready process gets CPU time up to the selected time quantum. Unfinished processes return to the end of the ready queue.",

        "sjf-pre": "Shortest Remaining Time First: always run the ready process with the smallest remaining burst time.",

        "sjf-non": "When the CPU becomes free, choose the ready process with the smallest burst time. It runs until completion."
    };

    document.getElementById("explain").textContent = explanations[id];
}

// Display process input fields
function renderInputs() {
    const showPriority = algorithms.find(a => a.id === selected).priority;

    document.getElementById("priorityHead").style.display =
        showPriority ? "" : "none";

    document.getElementById("inputs").innerHTML =
        processes.map((p, i) => `
            <tr>
                <td style="text-align:left">
                    <span class="dot" style="background:${p.c}"></span>
                    <b>${p.id}</b>
                </td>
                <td>
                    <input aria-label="${p.id} arrival"
                        type="number" min="0" value="${p.a}"
                        style="width:60px"
                        onchange="edit(${i}, 'a', this.value)">
                </td>
                <td>
                    <input aria-label="${p.id} burst"
                        type="number" min="1" value="${p.b}"
                        style="width:60px"
                        onchange="edit(${i}, 'b', this.value)">
                </td>
                ${showPriority ? `
                    <td>
                        <input aria-label="${p.id} priority"
                            type="number" min="1" value="${p.pri}"
                            style="width:60px"
                            onchange="edit(${i}, 'pri', this.value)">
                    </td>
                ` : ""}
            </tr>
        `).join("");
}

// Save an edited process value
function edit(index, field, value) {
    if (animationTimer) {
        clearInterval(animationTimer);
        animationTimer = null;
    }

    animationPaused = false;

    document.getElementById("pauseBtn").disabled = true;
    document.getElementById("liveClock").textContent =
        "Process data changed — click Run simulation to update results.";

    const number = Number(value);

    if (!Number.isFinite(number) || number < 0 ||
        (field !== "a" && number < 1)) {
        renderInputs();
        return;
    }

    processes[index][field] = number;
}
// Add a new process
function addProcess() {
    // Allow a maximum of 10 processes
    if (processes.length >= 10) {
        alert("You can add up to 10 processes.");
        return;
    }

    const number = processes.length + 1;

    const colors = [
        "#60a5fa",
        "#fb923c",
        "#6ee7b7",
        "#c4b5fd",
        "#f472b6",
        "#facc15",
        "#38bdf8",
        "#a3e635",
        "#fb7185",
        "#c084fc"
    ];

    processes.push({
        id: `P${number}`,
        a: 0,
        b: 3,
        pri: 1,
        c: colors[processes.length]
    });

    // Refresh the process input table
    renderInputs();

    // Clear the old animation
    if (animationTimer) {
        clearInterval(animationTimer);
        animationTimer = null;
    }

    animationPaused = false;
    activeRun++;

    document.getElementById("pauseBtn").disabled = true;

    document.getElementById("liveClock").textContent =
        "Process added. Click Run Simulation to update the results.";

    // Clear the old results
    document.getElementById("gantt").className = "empty";
    document.getElementById("gantt").textContent =
        "Run a simulation to generate the Gantt chart.";

    document.getElementById("elapsed").textContent = "";

    document.getElementById("results").innerHTML =
        '<tr><td colspan="8">Run a simulation to see results.</td></tr>';

    document.getElementById("stats").innerHTML = "";

    // Refresh the live process table
    renderLiveRows();
}

// Restore the default processes
function resetData() {
    processes = initial.map(p => ({ ...p }));
    renderInputs();
    run();
}

// Calculate the scheduling order
function simulate() {
    const quantum = selected === "rr"
        ? Math.max(1, Number(document.getElementById("quantum").value) || 2)
        : 1;

    const ps = processes.map(p => ({
        ...p,
        rem: p.b,
        first: null,
        ct: null
    }));

    const byId = Object.fromEntries(ps.map(p => [p.id, p]));
    const timeline = [];

    let time = 0;
    let previous = null;
    const rrQueue = [];
    const rrSeen = new Set();

    function addRR(currentTime) {
        ps.forEach(p => {
            if (p.a <= currentTime && !rrSeen.has(p.id) && p.rem > 0) {
                rrQueue.push(p.id);
                rrSeen.add(p.id);
            }
        });
    }

    while (ps.some(p => p.ct === null)) {
        let ready = ps.filter(p => p.a <= time && p.rem > 0);

        // If no process is ready, CPU stays idle until the next arrival.
        if (!ready.length) {
            const next = Math.min(
                ...ps.filter(p => p.rem > 0).map(p => p.a)
            );

            if (next > time) {
                timeline.push({ id: "IDLE", s: time, e: next });
                time = next;
            }

            ready = ps.filter(p => p.a <= time && p.rem > 0);
        }

        let process;

        if (selected === "rr") {
            addRR(time);
            const id = rrQueue.shift();
            process = byId[id];
        } else if (selected === "fcfs") {
            process = ready.sort((x, y) => x.a - y.a)[0];
        } else if (selected === "sjf-non") {
            process = ready.sort((x, y) => x.b - y.b || x.a - y.a)[0];
        } else if (selected === "priority-non") {
            process = ready.sort((x, y) => x.pri - y.pri || x.a - y.a)[0];
        } else if (selected === "sjf-pre") {
            process = ready.sort((x, y) => x.rem - y.rem || x.a - y.a)[0];
        } else {
            process = ready.sort((x, y) => x.pri - y.pri || x.a - y.a)[0];
        }

        if (!process) continue;

        if (process.first === null) {
            process.first = time;
        }

        let duration;

        if (selected === "rr") {
            duration = Math.min(quantum, process.rem);
        } else if (selected === "sjf-pre" || selected === "priority-pre") {
            const futureArrivals = ps
                .filter(p => p.a > time && p.rem > 0)
                .map(p => p.a);

            duration = Math.min(
                process.rem,
                Math.max(1, Math.min(...futureArrivals, time + process.rem) - time)
            );
        } else {
            duration = process.rem;
        }

        const start = time;
        time += duration;
        process.rem -= duration;

        timeline.push({ id: process.id, s: start, e: time });

        addRR(time);

        if (process.rem === 0) {
            process.ct = time;
        }

        previous = process.id;

        if (selected === "rr" && process.rem > 0) {
            rrQueue.push(process.id);
        }
    }

    // Calculate completion, turnaround, waiting, and response times.
    const rows = ps.map(p => ({
        id: p.id,
        a: p.a,
        b: p.b,
        pri: p.pri,
        ct: p.ct,
        tat: p.ct - p.a,
        wt: p.ct - p.a - p.b,
        rt: p.first - p.a,
        c: p.c
    }));

    const average = key =>
        rows.reduce((sum, row) => sum + row[key], 0) / rows.length;

    const totalBurst = ps.reduce((sum, p) => sum + p.b, 0);

    return {
        timeline,
        rows,
        elapsed: time,
        avgTAT: average("tat"),
        avgWT: average("wt"),
        avgRT: average("rt"),
        totalBurst
    };
}

// Show the Gantt chart and final results
function draw(result) {
    document.getElementById("gantt").className = "gantt";

    document.getElementById("gantt").innerHTML =
        result.timeline.map(segment => {
            const process = processes.find(p => p.id === segment.id);

            const color = segment.id === "IDLE"
                ? "#cbd5e1"
                : process.c;

            return `
                <div class="block"
                    style="background:${color};flex:${segment.e - segment.s} 0 auto">
                    ${segment.id}
                    <small>${segment.s}-${segment.e}</small>
                </div>
            `;
        }).join("");

    document.getElementById("elapsed").textContent =
        `Elapsed time: ${result.elapsed} ms · Context-switch overhead: not included`;

    const showPriority = algorithms.find(a => a.id === selected).priority;

    document.getElementById("priorityResultHead").style.display =
        showPriority ? "" : "none";

    document.getElementById("results").innerHTML =
        result.rows.map(p => `
            <tr>
                <td style="text-align:left">${p.id}</td>
                <td>${p.a}</td>
                <td>${p.b}</td>
                ${showPriority ? `<td>${p.pri}</td>` : ""}
                <td>${p.ct}</td>
                <td>${p.tat}</td>
                <td>${p.wt}</td>
                <td>${p.rt}</td>
            </tr>
        `).join("");

    const stats = [
        ["Average Turnaround", result.avgTAT],
        ["Average Waiting", result.avgWT],
        ["Average Response", result.avgRT]
    ];

    document.getElementById("stats").innerHTML =
        stats.map(item => `
            <div class="stat">
                <span>${item[0]}</span>
                <b>${item[1].toFixed(2)} ms</b>
            </div>
        `).join("");
}

// Create live status rows
function renderLiveRows() {
    document.getElementById("liveStatus").innerHTML =
        processes.map(p => `
            <tr>
                <td style="text-align:left"><b>${p.id}</b></td>
                <td>${p.a} ms</td>
                <td>
                    <div class="progress-track">
                        <div id="fill-${p.id}" class="progress-fill"></div>
                    </div>
                    <div id="state-${p.id}" class="process-state">Waiting</div>
                </td>
                <td id="rem-${p.id}">${p.b} ms</td>
                <td id="wt-${p.id}">—</td>
                <td id="ct-${p.id}">—</td>
            </tr>
        `).join("");
}

// Animate the bars gradually
function startAnimation(result, runId) {
    renderLiveRows();

    let simulationTime = 0;
    const maxTime = Math.max(result.elapsed, 1);

    // Increase this value to slow down the animation.
    const interval = 300;

    animationTimer = setInterval(() => {
        if (runId !== activeRun) {
            clearInterval(animationTimer);
            return;
        }

        if (animationPaused) return;

        simulationTime = Math.min(maxTime, simulationTime + maxTime / 100);

        const executed = Object.fromEntries(
            processes.map(p => [p.id, 0])
        );

        let runningProcess = null;

        result.timeline.forEach(segment => {
            if (segment.id === "IDLE") return;

            const used = Math.max(
                0,
                Math.min(simulationTime, segment.e) - segment.s
            );

            if (used > 0) executed[segment.id] += used;

            if (simulationTime >= segment.s && simulationTime < segment.e) {
                runningProcess = segment.id;
            }
        });

        processes.forEach(p => {
            const done = Math.min(p.b, executed[p.id] || 0);
            const remaining = Math.max(0, p.b - done);
            const row = result.rows.find(r => r.id === p.id);

            document.getElementById(`fill-${p.id}`).style.width =
                `${done / p.b * 100}%`;

            document.getElementById(`rem-${p.id}`).textContent =
                `${remaining.toFixed(remaining % 1 ? 1 : 0)} ms`;

            document.getElementById(`wt-${p.id}`).textContent =
                simulationTime < p.a
                    ? "—"
                    : `${Math.max(0, Math.min(simulationTime, row.ct) - p.a - done).toFixed(1)} ms`;

            document.getElementById(`ct-${p.id}`).textContent =
                simulationTime >= row.ct ? `${row.ct} ms` : "—";

            document.getElementById(`state-${p.id}`).textContent =
                simulationTime < p.a
                    ? "Not arrived"
                    : remaining === 0
                        ? "Completed"
                        : runningProcess === p.id
                            ? "Running now"
                            : done > 0
                                ? "Preempted / waiting"
                                : "Ready / waiting";
        });

        document.getElementById("liveClock").textContent =
            `Simulation time: ${simulationTime.toFixed(1)} / ${result.elapsed} ms`;

        if (simulationTime >= maxTime) {
            clearInterval(animationTimer);
            animationTimer = null;
            document.getElementById("pauseBtn").disabled = true;
            document.getElementById("pauseBtn").textContent = "⏸ Pause";
            document.getElementById("liveClock").textContent =
                `Simulation completed in ${result.elapsed} ms.`;
        }
    }, interval);
}

// Run or restart the simulation
function run() {
    if (animationTimer) {
        clearInterval(animationTimer);
        animationTimer = null;
    }

    animationPaused = false;
    activeRun++;

    const result = simulate();
    draw(result);

    document.getElementById("pauseBtn").disabled = false;
    document.getElementById("pauseBtn").textContent = "⏸ Pause";

    startAnimation(result, activeRun);
}

// Pause or resume the animation
function togglePause() {
    if (!animationTimer) return;

    animationPaused = !animationPaused;

    document.getElementById("pauseBtn").textContent =
        animationPaused ? "▶ Resume" : "⏸ Pause";

    if (animationPaused) {
        document.getElementById("liveClock").textContent += " — PAUSED";
    }
}

// Skip directly to the final results
function skipAnimation() {
    if (animationTimer) {
        clearInterval(animationTimer);
        animationTimer = null;
    }

    animationPaused = false;
    activeRun++;

    const result = simulate();

    draw(result);
    renderLiveRows();

    processes.forEach(p => {
        const row = result.rows.find(r => r.id === p.id);

        document.getElementById(`fill-${p.id}`).style.width = "100%";
        document.getElementById(`state-${p.id}`).textContent = "Completed";
        document.getElementById(`rem-${p.id}`).textContent = "0 ms";
        document.getElementById(`wt-${p.id}`).textContent = `${row.wt} ms`;
        document.getElementById(`ct-${p.id}`).textContent = `${row.ct} ms`;
    });

    document.getElementById("pauseBtn").disabled = true;
    document.getElementById("liveClock").textContent =
        `Simulation completed in ${result.elapsed} ms.`;
}

// Start the page
init();
renderLiveRows();
document.getElementById("gantt").textContent =
    "Choose your process values, then click Run simulation.";
document.getElementById("liveClock").textContent =
    "Ready — press Run simulation to begin.";
document.getElementById("pauseBtn").disabled = true;

// ---------------- DISK SCHEDULING: FCFS AND SSTF ----------------
function runDiskScheduling() {
    const algorithm = document.getElementById("diskAlgorithm").value;
    const headInput = document.getElementById("headPosition").value.trim();
    const requestInput = document.getElementById("diskRequests").value.trim();
    const errorBox = document.getElementById("diskError");

    errorBox.textContent = "";

    if (headInput === "" || requestInput === "") {
        errorBox.textContent = "Enter the initial head position and at least one disk request.";
        return;
    }

    const head = Number(headInput);
    const requests = requestInput.split(",").map(value => value.trim()).map(Number);

    if (!Number.isInteger(head) || head < 0 ||
        requests.some(value => !Number.isInteger(value) || value < 0)) {
        errorBox.textContent = "Use non-negative whole numbers for the head position and every request.";
        return;
    }

    let current = head;
    let pending = requests.map((track, index) => ({ track, index }));
    const sequence = [head];
    const steps = [];

    while (pending.length > 0) {
        let chosenIndex;

        if (algorithm === "fcfs") {
            chosenIndex = 0;
        } else {
            // SSTF: choose the pending request with the smallest distance
            // from the current head. Ties are resolved by original queue order.
            chosenIndex = 0;
            for (let i = 1; i < pending.length; i++) {
                const currentDistance = Math.abs(pending[chosenIndex].track - current);
                const candidateDistance = Math.abs(pending[i].track - current);
                if (candidateDistance < currentDistance) {
                    chosenIndex = i;
                }
            }
        }

        const request = pending.splice(chosenIndex, 1)[0];
        const distance = Math.abs(request.track - current);

        steps.push({
            step: steps.length + 1,
            from: current,
            to: request.track,
            distance
        });

        current = request.track;
        sequence.push(current);
    }

    const total = steps.reduce((sum, step) => sum + step.distance, 0);

    document.getElementById("diskSequence").innerHTML =
        sequence.map((track, index) =>
            `<span class="seek-node">${track}</span>${index < sequence.length - 1 ? '<span class="seek-arrow">→</span>' : ''}`
        ).join("");

    document.getElementById("totalSeek").textContent = `${total} tracks`;
    document.getElementById("requestCount").textContent = requests.length;
    document.getElementById("diskDetails").innerHTML = steps.map(step => `
        <tr>
            <td>${step.step}</td>
            <td>${step.from}</td>
            <td>${step.to}</td>
            <td>${step.distance}</td>
        </tr>
    `).join("");

    document.getElementById("diskExplanation").textContent =
        algorithm === "fcfs"
            ? "FCFS services disk requests in their original arrival order. It is simple and fair, but may cause large head movements."
            : "SSTF selects the pending request with the minimum seek distance from the current head position. It often reduces total head movement, but distant requests may wait longer.";
}

// Update the explanation when the disk algorithm changes.
document.getElementById("diskAlgorithm").addEventListener("change", function () {
    document.getElementById("diskExplanation").textContent =
        this.value === "fcfs"
            ? "FCFS services disk requests in their original arrival order."
            : "SSTF chooses the pending request closest to the current head position.";
});

// Display the default disk scheduling example on page load.
runDiskScheduling();
