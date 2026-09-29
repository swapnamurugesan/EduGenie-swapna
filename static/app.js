/**
 * EduGenie — Client-Side Application Logic
 * Vanilla JavaScript implementation for interactive educational workflows.
 */

document.addEventListener("DOMContentLoaded", () => {
    // Current application state
    let activeFeature = "qa";
    let isSubmitting = false;
    let currentResultData = null;
    let currentQuizState = null; // Holds active quiz questions and user selections

    // DOM Elements
    const navTabs = document.querySelectorAll(".nav-tab");
    const formSections = {
        qa: document.getElementById("form-section-qa"),
        explain: document.getElementById("form-section-explain"),
        quiz: document.getElementById("form-section-quiz"),
        summarize: document.getElementById("form-section-summarize"),
        learning_path: document.getElementById("form-section-learning_path"),
    };

    const form = document.getElementById("feature-form");
    const btnSubmit = document.getElementById("btn-submit");
    const btnSubmitText = btnSubmit.querySelector(".btn-text");
    const submitSpinner = document.getElementById("submit-spinner");
    const btnClear = document.getElementById("btn-clear");
    const btnLoadExample = document.getElementById("btn-load-example");

    // Result panel states
    const stateEmpty = document.getElementById("state-empty");
    const stateLoading = document.getElementById("state-loading");
    const stateError = document.getElementById("state-error");
    const stateContent = document.getElementById("state-content");
    const resultActionBar = document.getElementById("result-action-bar");
    const btnCopyResult = document.getElementById("btn-copy-result");
    const btnDownloadResult = document.getElementById("btn-download-result");
    const btnDismissError = document.getElementById("btn-dismiss-error");

    const errorTitle = document.getElementById("error-title");
    const errorMessage = document.getElementById("error-message");
    const errorDetailsBox = document.getElementById("error-details-box");
    const toast = document.getElementById("toast");

    // Character & Word Counters
    const qaQuestion = document.getElementById("qa-question");
    const qaCounter = document.getElementById("qa-counter");
    if (qaQuestion && qaCounter) {
        qaQuestion.addEventListener("input", () => {
            qaCounter.textContent = `${qaQuestion.value.length} / 1000`;
        });
    }

    const summarizePassage = document.getElementById("summarize-passage");
    const summaryWordCount = document.getElementById("summary-word-count");
    if (summarizePassage && summaryWordCount) {
        summarizePassage.addEventListener("input", () => {
            const count = countWords(summarizePassage.value);
            summaryWordCount.textContent = `${count} words`;
        });
    }

    // Example Presets
    const EXAMPLES = {
        qa: {
            question: "Which is the largest ocean on Earth and what role do its deep ocean currents play in regulating global climate?",
            level: "intermediate",
        },
        explain: {
            topic: "Pythagorean theorem",
            level: "beginner",
        },
        quiz: {
            topic: "Photosynthesis and cellular respiration in plant biology",
            difficulty: "intermediate",
        },
        summarize: {
            passage: "Plate tectonics is the scientific theory explaining the movement of the Earth's lithosphere, which is divided into several major and minor plates. These plates move relative to one another over the underlying asthenosphere. The interactions along plate boundaries are responsible for major geological events, including earthquakes, volcanic activity, mountain building, and oceanic trench formation. Divergent boundaries occur where plates pull apart, creating new crust as magma rises from the mantle. Convergent boundaries form when plates collide, often forcing one plate beneath another in a process called subduction. Transform boundaries involve plates sliding past one another horizontally, such as the San Andreas Fault in California. Understanding plate tectonics is fundamental to modern geology, volcanology, and seismology.",
            length: "medium",
            format: "paragraph",
        },
        learning_path: {
            topic: "Python for Data Science",
            goal: "Build data analysis pipelines, clean datasets, and create insightful visualizations",
            level: "beginner",
            duration: "4",
            time: "45 minutes / day",
        },
    };

    // Button Labels per Feature
    const SUBMIT_LABELS = {
        qa: "Generate Answer",
        explain: "Explain Concept",
        quiz: "Generate 3-Question Quiz",
        summarize: "Summarize Text",
        learning_path: "Build Learning Path",
    };

    // ==========================================
    // Tab Switching
    // ==========================================
    navTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            const feature = tab.getAttribute("data-feature");
            if (feature === activeFeature || isSubmitting) return;

            // Update Tab UI
            navTabs.forEach((t) => {
                t.classList.remove("active");
                t.setAttribute("aria-selected", "false");
            });
            tab.classList.add("active");
            tab.setAttribute("aria-selected", "true");

            // Update Form Sections
            Object.keys(formSections).forEach((key) => {
                if (formSections[key]) {
                    formSections[key].classList.toggle("hidden", key !== feature);
                }
            });

            activeFeature = feature;
            btnSubmitText.textContent = SUBMIT_LABELS[feature] || "Submit Request";
            resetError();
        });
    });

    // ==========================================
    // Load Example Preset
    // ==========================================
    btnLoadExample.addEventListener("click", () => {
        const example = EXAMPLES[activeFeature];
        if (!example) return;

        if (activeFeature === "qa") {
            document.getElementById("qa-question").value = example.question;
            document.getElementById("qa-level").value = example.level;
            qaCounter.textContent = `${example.question.length} / 1000`;
        } else if (activeFeature === "explain") {
            document.getElementById("explain-topic").value = example.topic;
            document.getElementById("explain-level").value = example.level;
        } else if (activeFeature === "quiz") {
            document.getElementById("quiz-topic").value = example.topic;
            document.getElementById("quiz-difficulty").value = example.difficulty;
        } else if (activeFeature === "summarize") {
            document.getElementById("summarize-passage").value = example.passage;
            document.getElementById("summarize-length").value = example.length;
            document.getElementById("summarize-format").value = example.format;
            summaryWordCount.textContent = `${countWords(example.passage)} words`;
        } else if (activeFeature === "learning_path") {
            document.getElementById("lp-topic").value = example.topic;
            document.getElementById("lp-goal").value = example.goal;
            document.getElementById("lp-level").value = example.level;
            document.getElementById("lp-duration").value = example.duration;
            document.getElementById("lp-time").value = example.time;
        }

        showToast("Example input loaded into form.");
    });

    // ==========================================
    // Clear Form & Results
    // ==========================================
    btnClear.addEventListener("click", () => {
        if (isSubmitting) return;

        if (activeFeature === "qa") {
            document.getElementById("qa-question").value = "";
            qaCounter.textContent = "0 / 1000";
        } else if (activeFeature === "explain") {
            document.getElementById("explain-topic").value = "";
        } else if (activeFeature === "quiz") {
            document.getElementById("quiz-topic").value = "";
        } else if (activeFeature === "summarize") {
            document.getElementById("summarize-passage").value = "";
            summaryWordCount.textContent = "0 words";
        } else if (activeFeature === "learning_path") {
            document.getElementById("lp-topic").value = "";
            document.getElementById("lp-goal").value = "";
        }

        currentResultData = null;
        currentQuizState = null;
        showEmptyState();
    });

    // ==========================================
    // Form Submission
    // ==========================================
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        let endpoint = "";
        let payload = {};

        // Build and validate payload
        if (activeFeature === "qa") {
            const question = document.getElementById("qa-question").value.trim();
            const level = document.getElementById("qa-level").value;
            if (!question) {
                showError("Validation Error", "Please enter an academic question.");
                return;
            }
            endpoint = "/qa";
            payload = { question, level };
        } else if (activeFeature === "explain") {
            const topic = document.getElementById("explain-topic").value.trim();
            const level = document.getElementById("explain-level").value;
            if (!topic) {
                showError("Validation Error", "Please specify a topic or concept to explain.");
                return;
            }
            endpoint = "/explain";
            payload = { topic, level };
        } else if (activeFeature === "quiz") {
            const topic_or_passage = document.getElementById("quiz-topic").value.trim();
            const difficulty = document.getElementById("quiz-difficulty").value;
            if (!topic_or_passage) {
                showError("Validation Error", "Please enter a topic or passage for the quiz.");
                return;
            }
            endpoint = "/quiz";
            payload = { topic_or_passage, difficulty };
        } else if (activeFeature === "summarize") {
            const passage = document.getElementById("summarize-passage").value.trim();
            const length = document.getElementById("summarize-length").value;
            const format = document.getElementById("summarize-format").value;
            const words = countWords(passage);
            if (!passage || words < 5) {
                showError("Validation Error", "Passage must contain at least 5 words.");
                return;
            }
            if (words > 2500) {
                showError("Validation Error", `Passage exceeds 2500 words (provided: ${words}).`);
                return;
            }
            endpoint = "/summarize";
            payload = { passage, length, format };
        } else if (activeFeature === "learning_path") {
            const topic = document.getElementById("lp-topic").value.trim();
            const goal = document.getElementById("lp-goal").value.trim();
            const current_level = document.getElementById("lp-level").value;
            const duration_weeks = parseInt(document.getElementById("lp-duration").value, 10);
            const daily_study_time = document.getElementById("lp-time").value.trim();
            if (!topic || !goal) {
                showError("Validation Error", "Please provide both a topic and a learning goal.");
                return;
            }
            endpoint = "/learn/recommendations";
            payload = { topic, goal, current_level, duration_weeks, daily_study_time };
        }

        // Execute API Request
        try {
            setLoading(true);
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                const err = data.error || {};
                const msg = err.message || data.detail || `Server returned status ${response.status}`;
                const details = err.details || (err.code ? `Error Code: ${err.code}` : "");
                showError("Request Failed", msg, details);
                return;
            }

            // Success
            currentResultData = { feature: activeFeature, data };
            renderResult(activeFeature, data);

        } catch (networkErr) {
            showError(
                "Network / Connection Error",
                "Could not communicate with the EduGenie backend server.",
                "Ensure the FastAPI server is running on http://127.0.0.1:8000."
            );
        } finally {
            setLoading(false);
        }
    });

    // ==========================================
    // Result Renderers
    // ==========================================
    function renderResult(feature, data) {
        stateEmpty.classList.add("hidden");
        stateLoading.classList.add("hidden");
        stateError.classList.add("hidden");
        stateContent.classList.remove("hidden");
        resultActionBar.classList.remove("hidden");
        stateContent.innerHTML = "";

        if (feature === "qa") {
            renderQAResult(data);
        } else if (feature === "explain") {
            renderExplainResult(data);
        } else if (feature === "quiz") {
            renderQuizResult(data);
        } else if (feature === "summarize") {
            renderSummarizeResult(data);
        } else if (feature === "learning_path") {
            renderLearningPathResult(data);
        }
    }

    function renderQAResult(data) {
        const header = createEl("div", "res-header");
        const title = createEl("h4", "res-title", data.question);
        const tag = createEl("span", "res-tag", `Level: ${capitalize(data.level)}`);
        header.appendChild(title);
        header.appendChild(tag);

        const answerSection = createEl("div", "res-section");
        const ansLabel = createEl("div", "res-section-title", "Academic Answer");
        const ansBody = createEl("p", "res-body-text", data.answer);
        answerSection.appendChild(ansLabel);
        answerSection.appendChild(ansBody);

        stateContent.appendChild(header);
        stateContent.appendChild(answerSection);

        if (data.key_points && data.key_points.length > 0) {
            const kpSection = createEl("div", "res-section");
            const kpLabel = createEl("div", "res-section-title", "Key Takeaways");
            const ul = createEl("ul", "key-points-list");
            data.key_points.forEach((kp) => {
                const li = createEl("li", "", kp);
                ul.appendChild(li);
            });
            kpSection.appendChild(kpLabel);
            kpSection.appendChild(ul);
            stateContent.appendChild(kpSection);
        }

        if (data.example) {
            const exSection = createEl("div", "res-section");
            const exLabel = createEl("div", "res-section-title", "Illustrative Example");
            const exBox = createEl("div", "example-box", data.example);
            exSection.appendChild(exLabel);
            exSection.appendChild(exBox);
            stateContent.appendChild(exSection);
        }
    }

    function renderExplainResult(data) {
        const header = createEl("div", "res-header");
        const title = createEl("h4", "res-title", `Concept: ${data.topic}`);
        const providerTag = createEl(
            "span",
            "res-tag",
            data.provider === "local" ? "⚡ Local LaMini Model" : "✨ Google Gemini"
        );
        header.appendChild(title);
        header.appendChild(providerTag);

        const expSection = createEl("div", "res-section");
        const expLabel = createEl("div", "res-section-title", `Explanation (${capitalize(data.level)} Level)`);
        const expBody = createEl("p", "res-body-text", data.explanation);
        expSection.appendChild(expLabel);
        expSection.appendChild(expBody);

        const analogySection = createEl("div", "res-section");
        const analogyLabel = createEl("div", "res-section-title", "Analogy / Practical Example");
        const analogyBox = createEl("div", "example-box", data.analogy_or_example);
        analogySection.appendChild(analogyLabel);
        analogySection.appendChild(analogyBox);

        const takeawaySection = createEl("div", "res-section");
        const takeawayLabel = createEl("div", "res-section-title", "Key Mental Hook / Takeaway");
        const takeawayBox = createEl("div", "takeaway-box", data.takeaway);
        takeawaySection.appendChild(takeawayLabel);
        takeawaySection.appendChild(takeawayBox);

        stateContent.appendChild(header);
        stateContent.appendChild(expSection);
        stateContent.appendChild(analogySection);
        stateContent.appendChild(takeawaySection);
    }

    function renderQuizResult(data) {
        currentQuizState = {
            data: data,
            submitted: false,
        };

        const container = createEl("div", "quiz-container");

        const header = createEl("div", "res-header");
        const title = createEl("h4", "res-title", `Quiz: ${data.topic_or_passage.slice(0, 45)}...`);
        const badge = createEl("span", "res-tag", `Difficulty: ${capitalize(data.difficulty)} • 3 Questions`);
        header.appendChild(title);
        header.appendChild(badge);
        container.appendChild(header);

        // Score placeholder banner
        const scoreBanner = createEl("div", "quiz-score-banner hidden", "", "quiz-score-banner");
        container.appendChild(scoreBanner);

        // Questions
        data.questions.forEach((q, qIndex) => {
            const card = createEl("div", "quiz-q-card", "", `quiz-card-${qIndex}`);

            const qHead = createEl("div", "quiz-q-header");
            const qNum = createEl("span", "quiz-q-num", `Q${qIndex + 1}`);
            const qText = createEl("span", "quiz-q-text", q.question);
            qHead.appendChild(qNum);
            qHead.appendChild(qText);
            card.appendChild(qHead);

            const optList = createEl("div", "quiz-options-list");
            q.options.forEach((optText, optIndex) => {
                const label = createEl("label", "quiz-option-label", "", `label-q${qIndex}-opt${optIndex}`);
                const radio = document.createElement("input");
                radio.type = "radio";
                radio.name = `quiz-question-${qIndex}`;
                radio.value = optIndex;
                radio.id = `q${qIndex}-opt${optIndex}`;

                const textSpan = createEl("span", "", optText);
                label.appendChild(radio);
                label.appendChild(textSpan);
                optList.appendChild(label);
            });
            card.appendChild(optList);

            // Explanation box (initially hidden)
            const expBox = createEl("div", "quiz-explanation-box hidden", `Explanation: ${q.explanation}`, `quiz-exp-${qIndex}`);
            card.appendChild(expBox);

            container.appendChild(card);
        });

        // Quiz Action Buttons
        const actionRow = createEl("div", "quiz-actions-bar");
        const submitQuizBtn = createEl("button", "btn btn-primary", "Submit Answers", "btn-submit-quiz");
        submitQuizBtn.type = "button";
        submitQuizBtn.addEventListener("click", () => handleQuizSubmission(data));

        const retryQuizBtn = createEl("button", "btn btn-secondary hidden", "Retry This Quiz", "btn-retry-quiz");
        retryQuizBtn.type = "button";
        retryQuizBtn.addEventListener("click", () => renderQuizResult(data));

        actionRow.appendChild(submitQuizBtn);
        actionRow.appendChild(retryQuizBtn);
        container.appendChild(actionRow);

        stateContent.appendChild(container);
    }

    function handleQuizSubmission(data) {
        // Verify all 3 questions answered
        const answers = [];
        for (let i = 0; i < 3; i++) {
            const selected = document.querySelector(`input[name="quiz-question-${i}"]:checked`);
            if (!selected) {
                showToast(`Please select an answer for Question ${i + 1} before submitting.`);
                return;
            }
            answers.push(parseInt(selected.value, 10));
        }

        // Calculate score
        let score = 0;
        data.questions.forEach((q, i) => {
            const userChoice = answers[i];
            const correctChoice = q.correct_option_index;
            const expBox = document.getElementById(`quiz-exp-${i}`);

            if (expBox) expBox.classList.remove("hidden");

            // Mark labels
            q.options.forEach((_, optIdx) => {
                const label = document.getElementById(`label-q${i}-opt${optIdx}`);
                const radio = document.getElementById(`q${i}-opt${optIdx}`);
                if (radio) radio.disabled = true;

                if (optIdx === correctChoice) {
                    label.classList.add("opt-correct");
                    label.innerHTML += ' <span style="margin-left:auto; font-size:0.75rem;">✔ Correct Answer</span>';
                } else if (optIdx === userChoice && userChoice !== correctChoice) {
                    label.classList.add("opt-incorrect");
                    label.innerHTML += ' <span style="margin-left:auto; font-size:0.75rem;">✖ Your Choice</span>';
                }
            });

            if (userChoice === correctChoice) {
                score++;
            }
        });

        // Show score banner
        const scoreBanner = document.getElementById("quiz-score-banner");
        if (scoreBanner) {
            scoreBanner.classList.remove("hidden");
            const percentage = Math.round((score / 3) * 100);
            scoreBanner.innerHTML = `
                <div>
                    <strong>Practice Quiz Complete</strong>
                    <div style="font-size:0.85rem; color:var(--text-secondary); margin-top:0.2rem;">Review your answers and explanations below.</div>
                </div>
                <div class="quiz-score-val">${score} / 3 (${percentage}%)</div>
            `;
        }

        // Toggle buttons
        const submitBtn = document.getElementById("btn-submit-quiz");
        const retryBtn = document.getElementById("btn-retry-quiz");
        if (submitBtn) submitBtn.classList.add("hidden");
        if (retryBtn) retryBtn.classList.remove("hidden");
    }

    function renderSummarizeResult(data) {
        const header = createEl("div", "res-header");
        const title = createEl("h4", "res-title", "Educational Summary");
        const reduction = data.original_word_count > 0
            ? Math.round((1 - data.summary_word_count / data.original_word_count) * 100)
            : 0;
        const badge = createEl(
            "span",
            "res-tag",
            `${data.original_word_count} words → ${data.summary_word_count} words (${reduction}% concise)`
        );
        header.appendChild(title);
        header.appendChild(badge);

        const summarySection = createEl("div", "res-section");
        const label = createEl("div", "res-section-title", `Summary (${capitalize(data.length)} • ${data.format.replace('_', ' ')})`);
        const body = createEl("div", "res-body-text", data.summary);
        summarySection.appendChild(label);
        summarySection.appendChild(body);

        stateContent.appendChild(header);
        stateContent.appendChild(summarySection);
    }

    function renderLearningPathResult(data) {
        const header = createEl("div", "res-header");
        const title = createEl("h4", "res-title", `Curriculum: ${data.topic}`);
        const tag = createEl("span", "res-tag", `Duration: ~${data.estimated_duration_weeks} Weeks (Estimate)`);
        header.appendChild(title);
        header.appendChild(tag);

        const overviewSection = createEl("div", "res-section");
        const ovLabel = createEl("div", "res-section-title", "Curriculum Overview & Goal");
        const ovText = createEl("p", "res-body-text", `${data.overview}\n\nPrimary Goal: ${data.goal}`);
        overviewSection.appendChild(ovLabel);
        overviewSection.appendChild(ovText);

        stateContent.appendChild(header);
        stateContent.appendChild(overviewSection);

        // Prerequisites
        if (data.prerequisites && data.prerequisites.length > 0) {
            const preSection = createEl("div", "res-section");
            const preLabel = createEl("div", "res-section-title", "Recommended Prerequisites");
            const ul = createEl("ul", "key-points-list");
            data.prerequisites.forEach((p) => {
                ul.appendChild(createEl("li", "", p));
            });
            preSection.appendChild(preLabel);
            preSection.appendChild(ul);
            stateContent.appendChild(preSection);
        }

        // Weekly Schedule
        const scheduleSection = createEl("div", "res-section");
        const schLabel = createEl("div", "res-section-title", "Week-by-Week Learning Roadmap");
        const timeline = createEl("div", "timeline-container");

        data.weekly_schedule.forEach((week) => {
            const card = createEl("div", "timeline-week-card");
            const wTitle = createEl("div", "week-title", `Week ${week.week_number}: ${week.title}`);
            card.appendChild(wTitle);

            if (week.focus_concepts && week.focus_concepts.length > 0) {
                const cHead = createEl("div", "form-label", "Key Concepts:");
                const cList = createEl("ul", "week-sublist");
                week.focus_concepts.forEach((c) => cList.appendChild(createEl("li", "", c)));
                card.appendChild(cHead);
                card.appendChild(cList);
            }

            if (week.practice_activities && week.practice_activities.length > 0) {
                const aHead = createEl("div", "form-label", "Practice Activities:");
                const aList = createEl("ul", "week-sublist");
                week.practice_activities.forEach((a) => aList.appendChild(createEl("li", "", a)));
                card.appendChild(aHead);
                card.appendChild(aList);
            }

            if (week.milestone_question) {
                const mBox = createEl("div", "example-box", `Self-Check Milestone: ${week.milestone_question}`);
                card.appendChild(mBox);
            }

            timeline.appendChild(card);
        });

        scheduleSection.appendChild(schLabel);
        scheduleSection.appendChild(timeline);
        stateContent.appendChild(scheduleSection);

        // Final Project
        if (data.final_project) {
            const projSection = createEl("div", "res-section");
            const pLabel = createEl("div", "res-section-title", "Capstone Mini-Project");
            const pBox = createEl("div", "takeaway-box", data.final_project);
            projSection.appendChild(pLabel);
            projSection.appendChild(pBox);
            stateContent.appendChild(projSection);
        }

        // Suggested Resource Search Topics
        if (data.suggested_resources && data.suggested_resources.length > 0) {
            const resSection = createEl("div", "res-section");
            const rLabel = createEl("div", "res-section-title", "Suggested Study Topics & Reference Queries");
            const pillsDiv = createEl("div", "resource-pills");
            data.suggested_resources.forEach((r) => {
                pillsDiv.appendChild(createEl("span", "resource-pill", `🔍 ${r}`));
            });
            resSection.appendChild(rLabel);
            resSection.appendChild(pillsDiv);
            stateContent.appendChild(resSection);
        }
    }

    // ==========================================
    // Copy & Download
    // ==========================================
    btnCopyResult.addEventListener("click", () => {
        if (!currentResultData) return;
        const text = formatResultAsPlainText(currentResultData);
        navigator.clipboard.writeText(text).then(
            () => showToast("Copied result to clipboard!"),
            () => showToast("Failed to copy result.")
        );
    });

    btnDownloadResult.addEventListener("click", () => {
        if (!currentResultData) return;
        const text = formatResultAsPlainText(currentResultData);
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `EduGenie_${currentResultData.feature}_${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("Downloaded text report.");
    });

    btnDismissError.addEventListener("click", () => {
        resetError();
        if (!currentResultData) {
            showEmptyState();
        } else {
            stateContent.classList.remove("hidden");
        }
    });

    // ==========================================
    // Helpers
    // ==========================================
    function setLoading(isLoading) {
        isSubmitting = isLoading;
        btnSubmit.disabled = isLoading;
        submitSpinner.classList.toggle("hidden", !isLoading);

        if (isLoading) {
            stateEmpty.classList.add("hidden");
            stateError.classList.add("hidden");
            stateContent.classList.add("hidden");
            resultActionBar.classList.add("hidden");
            stateLoading.classList.remove("hidden");
        } else {
            stateLoading.classList.add("hidden");
        }
    }

    function showEmptyState() {
        stateEmpty.classList.remove("hidden");
        stateLoading.classList.add("hidden");
        stateError.classList.add("hidden");
        stateContent.classList.add("hidden");
        resultActionBar.classList.add("hidden");
    }

    function showError(title, message, details = "") {
        stateEmpty.classList.add("hidden");
        stateLoading.classList.add("hidden");
        stateContent.classList.add("hidden");
        stateError.classList.remove("hidden");

        errorTitle.textContent = title;
        errorMessage.textContent = message;

        if (details) {
            errorDetailsBox.classList.remove("hidden");
            errorDetailsBox.querySelector("code").textContent = details;
        } else {
            errorDetailsBox.classList.add("hidden");
        }
    }

    function resetError() {
        stateError.classList.add("hidden");
        errorDetailsBox.classList.add("hidden");
    }

    function showToast(msg) {
        toast.textContent = msg;
        toast.classList.remove("hidden");
        setTimeout(() => toast.classList.add("hidden"), 3000);
    }

    function countWords(str) {
        if (!str) return 0;
        const matches = str.trim().match(/\S+/g);
        return matches ? matches.length : 0;
    }

    function capitalize(str) {
        if (!str) return "";
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function createEl(tag, className = "", text = "", id = "") {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text) el.textContent = text;
        if (id) el.id = id;
        return el;
    }

    function formatResultAsPlainText(resultObj) {
        const { feature, data } = resultObj;
        let out = `EduGenie — AI Generated Report\nFeature: ${feature.toUpperCase()}\nDate: ${new Date().toLocaleString()}\n----------------------------------------\n\n`;

        if (feature === "qa") {
            out += `Question: ${data.question}\nLevel: ${data.level}\n\nAnswer:\n${data.answer}\n\n`;
            if (data.key_points && data.key_points.length) {
                out += `Key Takeaways:\n${data.key_points.map((p) => `- ${p}`).join("\n")}\n\n`;
            }
            if (data.example) {
                out += `Example:\n${data.example}\n\n`;
            }
        } else if (feature === "explain") {
            out += `Concept: ${data.topic}\nLevel: ${data.level}\nProvider: ${data.provider}\n\nExplanation:\n${data.explanation}\n\nAnalogy/Example:\n${data.analogy_or_example}\n\nTakeaway:\n${data.takeaway}\n\n`;
        } else if (feature === "quiz") {
            out += `Topic: ${data.topic_or_passage}\nDifficulty: ${data.difficulty}\n\n`;
            data.questions.forEach((q, i) => {
                out += `Question ${i + 1}: ${q.question}\n`;
                q.options.forEach((opt, idx) => {
                    out += `  [${String.fromCharCode(65 + idx)}] ${opt}\n`;
                });
                out += `Correct Answer: [${String.fromCharCode(65 + q.correct_option_index)}] ${q.options[q.correct_option_index]}\n`;
                out += `Explanation: ${q.explanation}\n\n`;
            });
        } else if (feature === "summarize") {
            out += `Original Word Count: ${data.original_word_count}\nSummary Word Count: ${data.summary_word_count}\nLength: ${data.length}\nFormat: ${data.format}\n\nSummary:\n${data.summary}\n\n`;
        } else if (feature === "learning_path") {
            out += `Topic: ${data.topic}\nCurrent Level: ${data.current_level}\nGoal: ${data.goal}\nDuration: ~${data.estimated_duration_weeks} weeks\n\nOverview:\n${data.overview}\n\n`;
            if (data.prerequisites && data.prerequisites.length) {
                out += `Prerequisites:\n${data.prerequisites.map((p) => `- ${p}`).join("\n")}\n\n`;
            }
            out += `Weekly Schedule:\n`;
            data.weekly_schedule.forEach((w) => {
                out += `Week ${w.week_number}: ${w.title}\n`;
                if (w.focus_concepts && w.focus_concepts.length) {
                    out += `  Concepts: ${w.focus_concepts.join(", ")}\n`;
                }
                if (w.practice_activities && w.practice_activities.length) {
                    out += `  Activities: ${w.practice_activities.join(", ")}\n`;
                }
                if (w.milestone_question) {
                    out += `  Milestone: ${w.milestone_question}\n`;
                }
                out += `\n`;
            });
            if (data.final_project) {
                out += `Capstone Project:\n${data.final_project}\n\n`;
            }
            if (data.suggested_resources && data.suggested_resources.length) {
                out += `Suggested Resources:\n${data.suggested_resources.map((r) => `- ${r}`).join("\n")}\n`;
            }
        }
        return out;
    }
});
