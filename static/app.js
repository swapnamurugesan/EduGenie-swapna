/**
 * EduGenie — Redesigned Learning Workspace Application Logic
 * Vanilla JavaScript implementation for student-friendly academic tooling.
 */

document.addEventListener("DOMContentLoaded", () => {
    // Application State
    let activeFeature = "qa";
    let isSubmitting = false;
    let activeRequestId = 0;
    let currentResultData = null;

    // Feature Metadata Configuration
    const TOOL_META = {
        qa: {
            title: "Ask a Question",
            desc: "Find clarity, one question at a time.",
            submitLabel: "Get Answer",
            loadingTitle: "Finding your answer...",
            loadingSubtitle: "Synthesizing educational insights and practical examples.",
        },
        explain: {
            title: "Explain a Concept",
            desc: "Make difficult ideas easier to understand.",
            submitLabel: "Explain Simply",
            loadingTitle: "Preparing your explanation...",
            loadingSubtitle: "Breaking down the concept with intuitive analogies.",
        },
        quiz: {
            title: "Practice Quiz",
            desc: "Check what you know.",
            submitLabel: "Generate 3 Questions",
            loadingTitle: "Generating practice questions...",
            loadingSubtitle: "Creating 3 multiple-choice questions with answer keys.",
        },
        summarize: {
            title: "Summarize Notes",
            desc: "Turn long notes into clear takeaways.",
            submitLabel: "Summarize Notes",
            loadingTitle: "Summarizing study notes...",
            loadingSubtitle: "Condensing facts while faithfully preserving key ideas.",
        },
        learning_path: {
            title: "Learning Plan",
            desc: "Build a practical path toward your goal.",
            submitLabel: "Create My Plan",
            loadingTitle: "Crafting your learning plan...",
            loadingSubtitle: "Structuring an ordered week-by-week curriculum.",
        },
    };

    // Example Presets
    const EXAMPLES = {
        qa: {
            question: "Which is the largest ocean on Earth and how do deep ocean currents regulate global climate?",
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

    // DOM Elements
    const sidebarNavTabs = document.querySelectorAll(".sidebar-nav .nav-item");
    const mobileNavTabs = document.querySelectorAll(".mobile-nav .mobile-nav-tab");

    const activeToolTitle = document.getElementById("active-tool-title");
    const activeToolDesc = document.getElementById("active-tool-desc");

    const formSections = {
        qa: document.getElementById("form-section-qa"),
        explain: document.getElementById("form-section-explain"),
        quiz: document.getElementById("form-section-quiz"),
        summarize: document.getElementById("form-section-summarize"),
        learning_path: document.getElementById("form-section-learning_path"),
    };

    const form = document.getElementById("workspace-form");
    const btnSubmit = document.getElementById("btn-submit");
    const btnSubmitText = btnSubmit.querySelector(".btn-text");
    const btnSpinner = document.getElementById("btn-spinner");
    const btnClear = document.getElementById("btn-clear");
    const btnLoadExample = document.getElementById("btn-load-example");

    // Result States
    const stateEmpty = document.getElementById("state-empty");
    const stateLoading = document.getElementById("state-loading");
    const stateError = document.getElementById("state-error");
    const stateContent = document.getElementById("state-content");
    const resultActionBar = document.getElementById("result-action-bar");

    const loadingTitle = document.getElementById("loading-title");
    const loadingSubtitle = document.getElementById("loading-subtitle");

    const errorTitle = document.getElementById("error-title");
    const errorMessage = document.getElementById("error-message");
    const errorDetailsBox = document.getElementById("error-details-box");
    const btnDismissError = document.getElementById("btn-dismiss-error");

    const btnCopyResult = document.getElementById("btn-copy-result");
    const btnDownloadResult = document.getElementById("btn-download-result");
    const toast = document.getElementById("toast");

    // Live Counters
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

    // ==========================================
    // Tool Navigation Switching
    // ==========================================
    function switchFeature(feature) {
        if (feature === activeFeature || isSubmitting) return;

        activeFeature = feature;
        const meta = TOOL_META[feature] || TOOL_META.qa;

        // Update Header Titles
        activeToolTitle.textContent = meta.title;
        activeToolDesc.textContent = meta.desc;
        btnSubmitText.textContent = meta.submitLabel;

        // Update Desktop Sidebar active states
        sidebarNavTabs.forEach((tab) => {
            const isActive = tab.getAttribute("data-feature") === feature;
            tab.classList.toggle("active", isActive);
            tab.setAttribute("aria-selected", isActive ? "true" : "false");
        });

        // Update Mobile Nav active states
        mobileNavTabs.forEach((tab) => {
            const isActive = tab.getAttribute("data-feature") === feature;
            tab.classList.toggle("active", isActive);
        });

        // Toggle Form Sections
        Object.keys(formSections).forEach((key) => {
            if (formSections[key]) {
                formSections[key].classList.toggle("hidden", key !== feature);
            }
        });

        // Clear error display if any
        resetError();

        // Switch result viewport if result matches or show empty
        if (currentResultData && currentResultData.feature === feature) {
            renderResult(feature, currentResultData.data);
        } else {
            showEmptyState();
        }
    }

    sidebarNavTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            const feature = tab.getAttribute("data-feature");
            switchFeature(feature);
        });
    });

    mobileNavTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            const feature = tab.getAttribute("data-feature");
            switchFeature(feature);
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

        showToast("Example loaded into form.");
    });

    // ==========================================
    // Clear Active Form & Results
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
        showEmptyState();
        showToast("Form cleared.");
    });

    // ==========================================
    // Form Submission & API Fetching
    // ==========================================
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        let endpoint = "";
        let payload = {};

        // Validation & payload assembly
        if (activeFeature === "qa") {
            const question = document.getElementById("qa-question").value.trim();
            const level = document.getElementById("qa-level").value;
            if (!question) {
                showError("Missing Input", "Please enter an academic question to proceed.");
                return;
            }
            endpoint = "/qa";
            payload = { question, level };
        } else if (activeFeature === "explain") {
            const topic = document.getElementById("explain-topic").value.trim();
            const level = document.getElementById("explain-level").value;
            if (!topic) {
                showError("Missing Input", "Please enter a concept or topic to explain.");
                return;
            }
            endpoint = "/explain";
            payload = { topic, level };
        } else if (activeFeature === "quiz") {
            const topic_or_passage = document.getElementById("quiz-topic").value.trim();
            const difficulty = document.getElementById("quiz-difficulty").value;
            if (!topic_or_passage) {
                showError("Missing Input", "Please enter a topic or text passage to generate a quiz.");
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
                showError("Input Too Short", "Please provide a study passage with at least 5 words.");
                return;
            }
            if (words > 2500) {
                showError("Input Limit Exceeded", `Passage contains ${words} words (maximum allowed is 2500 words).`);
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
                showError("Missing Fields", "Please enter both a topic and your primary learning goal.");
                return;
            }
            endpoint = "/learn/recommendations";
            payload = { topic, goal, current_level, duration_weeks, daily_study_time };
        }

        // Issue request with ID tracking
        const requestId = ++activeRequestId;
        const requestedFeature = activeFeature;

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

            // Prevent stale/delayed responses from conflicting with switched tabs
            if (requestId !== activeRequestId) return;

            const data = await response.json();

            if (!response.ok) {
                const err = data.error || {};
                const msg = err.message || data.detail || `Server returned error (${response.status})`;
                const details = err.details || (err.code ? `Error Code: ${err.code}` : "");
                showError("Generation Issue", msg, details);
                return;
            }

            // Successfully received response
            currentResultData = { feature: requestedFeature, data };
            renderResult(requestedFeature, data);

        } catch (networkErr) {
            if (requestId === activeRequestId) {
                showError(
                    "Connection Error",
                    "Could not connect to the EduGenie application server.",
                    "Ensure the FastAPI server is running on http://127.0.0.1:8000."
                );
            }
        } finally {
            if (requestId === activeRequestId) {
                setLoading(false);
            }
        }
    });

    // ==========================================
    // Result Renderers (Safe DOM Construction)
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
        const topRow = createEl("div", "content-top-badge-row");
        const title = createEl("h3", "content-main-title", data.question);
        const levelBadge = createEl("span", "badge-pill", `Level: ${capitalize(data.level)}`);
        topRow.appendChild(title);
        topRow.appendChild(levelBadge);

        const ansBlock = createEl("div", "content-block");
        const ansHeading = createEl("div", "block-heading", "Academic Answer");
        const ansBody = createEl("p", "body-prose", data.answer);
        ansBlock.appendChild(ansHeading);
        ansBlock.appendChild(ansBody);

        stateContent.appendChild(topRow);
        stateContent.appendChild(ansBlock);

        if (data.key_points && data.key_points.length > 0) {
            const kpBlock = createEl("div", "content-block");
            const kpHeading = createEl("div", "block-heading", "Key Takeaways");
            const ul = createEl("ul", "takeaways-list");
            data.key_points.forEach((kp) => {
                ul.appendChild(createEl("li", "", kp));
            });
            kpBlock.appendChild(kpHeading);
            kpBlock.appendChild(ul);
            stateContent.appendChild(kpBlock);
        }

        if (data.example) {
            const exBlock = createEl("div", "content-block");
            const exHeading = createEl("div", "block-heading", "Illustrative Example");
            const exBox = createEl("div", "callout-example", data.example);
            exBlock.appendChild(exHeading);
            exBlock.appendChild(exBox);
            stateContent.appendChild(exBlock);
        }
    }

    function renderExplainResult(data) {
        const topRow = createEl("div", "content-top-badge-row");
        const title = createEl("h3", "content-main-title", `Concept: ${data.topic}`);
        const providerPill = createEl(
            "span",
            "badge-pill",
            data.provider === "local" ? "⚡ Local Model" : "✨ Google Gemini"
        );
        topRow.appendChild(title);
        topRow.appendChild(providerPill);

        const expBlock = createEl("div", "content-block");
        const expHeading = createEl("div", "block-heading", `Plain Explanation (${capitalize(data.level)})`);
        const expBody = createEl("p", "body-prose", data.explanation);
        expBlock.appendChild(expHeading);
        expBlock.appendChild(expBody);

        const analogyBlock = createEl("div", "content-block");
        const analogyHeading = createEl("div", "block-heading", "Analogy / Practical Illustration");
        const analogyBox = createEl("div", "callout-example", data.analogy_or_example);
        analogyBlock.appendChild(analogyHeading);
        analogyBlock.appendChild(analogyBox);

        const takeawayBlock = createEl("div", "content-block");
        const takeawayHeading = createEl("div", "block-heading", "Key Takeaway");
        const takeawayBox = createEl("div", "callout-takeaway", data.takeaway);
        takeawayBlock.appendChild(takeawayHeading);
        takeawayBlock.appendChild(takeawayBox);

        stateContent.appendChild(topRow);
        stateContent.appendChild(expBlock);
        stateContent.appendChild(analogyBlock);
        stateContent.appendChild(takeawayBlock);
    }

    function renderQuizResult(data) {
        const wrapper = createEl("div", "quiz-wrapper");

        const topRow = createEl("div", "content-top-badge-row");
        const title = createEl("h3", "content-main-title", `Quiz: ${data.topic_or_passage.slice(0, 48)}...`);
        const badge = createEl("span", "badge-pill", `${capitalize(data.difficulty)} • 3 Questions`);
        topRow.appendChild(title);
        topRow.appendChild(badge);
        wrapper.appendChild(topRow);

        // Score Card (Hidden until submission)
        const scoreCard = createEl("div", "quiz-score-card hidden", "", "quiz-score-card");
        wrapper.appendChild(scoreCard);

        // 3 Separate Question Cards
        data.questions.forEach((q, qIndex) => {
            const card = createEl("div", "quiz-card", "", `quiz-q-card-${qIndex}`);

            const head = createEl("div", "quiz-card-head");
            const indicator = createEl("span", "quiz-q-indicator", `Question ${qIndex + 1} of 3`);
            const prompt = createEl("h4", "quiz-q-prompt", q.question);
            head.appendChild(indicator);
            head.appendChild(prompt);
            card.appendChild(head);

            const optionsGroup = createEl("div", "quiz-options-group");
            q.options.forEach((optText, optIndex) => {
                const label = createEl("label", "quiz-option-row", "", `label-q${qIndex}-opt${optIndex}`);
                const radio = document.createElement("input");
                radio.type = "radio";
                radio.name = `quiz-q-${qIndex}`;
                radio.value = optIndex;
                radio.id = `q${qIndex}-opt${optIndex}`;

                const textSpan = createEl("span", "", optText);
                label.appendChild(radio);
                label.appendChild(textSpan);
                optionsGroup.appendChild(label);
            });
            card.appendChild(optionsGroup);

            // Explanation Callout (Hidden until submission)
            const expPanel = createEl("div", "quiz-explanation-panel hidden", `Explanation: ${q.explanation}`, `quiz-exp-panel-${qIndex}`);
            card.appendChild(expPanel);

            wrapper.appendChild(card);
        });

        // Quiz Actions
        const actionsRow = createEl("div", "quiz-action-bar");
        const submitBtn = createEl("button", "btn btn-primary", "Submit Quiz Answers", "btn-submit-quiz");
        submitBtn.type = "button";
        submitBtn.addEventListener("click", () => handleQuizScoring(data));

        const retryBtn = createEl("button", "btn btn-secondary hidden", "Retry Quiz", "btn-retry-quiz");
        retryBtn.type = "button";
        retryBtn.addEventListener("click", () => renderQuizResult(data));

        actionsRow.appendChild(submitBtn);
        actionsRow.appendChild(retryBtn);
        wrapper.appendChild(actionsRow);

        stateContent.appendChild(wrapper);
    }

    function handleQuizScoring(data) {
        const answers = [];
        for (let i = 0; i < 3; i++) {
            const selected = document.querySelector(`input[name="quiz-q-${i}"]:checked`);
            if (!selected) {
                showToast(`Please answer Question ${i + 1} before submitting.`);
                return;
            }
            answers.push(parseInt(selected.value, 10));
        }

        let score = 0;
        data.questions.forEach((q, i) => {
            const userChoice = answers[i];
            const correctChoice = q.correct_option_index;
            const expPanel = document.getElementById(`quiz-exp-panel-${i}`);

            if (expPanel) expPanel.classList.remove("hidden");

            q.options.forEach((_, optIdx) => {
                const label = document.getElementById(`label-q${i}-opt${optIdx}`);
                const radio = document.getElementById(`q${i}-opt${optIdx}`);
                if (radio) radio.disabled = true;

                if (optIdx === correctChoice) {
                    label.classList.add("is-correct");
                    const badge = createEl("span", "quiz-option-badge", "✔ Correct");
                    label.appendChild(badge);
                } else if (optIdx === userChoice && userChoice !== correctChoice) {
                    label.classList.add("is-incorrect");
                    const badge = createEl("span", "quiz-option-badge", "✖ Your Choice");
                    label.appendChild(badge);
                }
            });

            if (userChoice === correctChoice) {
                score++;
            }
        });

        // Update score banner
        const scoreCard = document.getElementById("quiz-score-card");
        if (scoreCard) {
            scoreCard.classList.remove("hidden");
            const pct = Math.round((score / 3) * 100);
            scoreCard.innerHTML = `
                <div>
                    <div class="score-title">Quiz Results</div>
                    <div class="score-desc">Review question explanations below to reinforce your understanding.</div>
                </div>
                <div class="score-number">${score} / 3 (${pct}%)</div>
            `;
        }

        const submitBtn = document.getElementById("btn-submit-quiz");
        const retryBtn = document.getElementById("btn-retry-quiz");
        if (submitBtn) submitBtn.classList.add("hidden");
        if (retryBtn) retryBtn.classList.remove("hidden");
    }

    function renderSummarizeResult(data) {
        const topRow = createEl("div", "content-top-badge-row");
        const title = createEl("h3", "content-main-title", "Summary Notes");
        const reduction = data.original_word_count > 0
            ? Math.round((1 - data.summary_word_count / data.original_word_count) * 100)
            : 0;
        const statPill = createEl(
            "span",
            "badge-pill",
            `${data.original_word_count} words → ${data.summary_word_count} words (${reduction}% reduction)`
        );
        topRow.appendChild(title);
        topRow.appendChild(statPill);

        const sumBlock = createEl("div", "content-block");
        const sumHeading = createEl("div", "block-heading", `Summary (${capitalize(data.length)} • ${data.format.replace('_', ' ')})`);
        const sumBody = createEl("div", "body-prose", data.summary);
        sumBlock.appendChild(sumHeading);
        sumBlock.appendChild(sumBody);

        stateContent.appendChild(topRow);
        stateContent.appendChild(sumBlock);
    }

    function renderLearningPathResult(data) {
        const topRow = createEl("div", "content-top-badge-row");
        const title = createEl("h3", "content-main-title", `Plan: ${data.topic}`);
        const tag = createEl("span", "badge-pill", `Duration: ~${data.estimated_duration_weeks} Weeks`);
        topRow.appendChild(title);
        topRow.appendChild(tag);

        const ovBlock = createEl("div", "content-block");
        const ovHeading = createEl("div", "block-heading", "Curriculum Overview & Goal");
        const ovBody = createEl("p", "body-prose", `${data.overview}\n\nPrimary Goal: ${data.goal}`);
        ovBlock.appendChild(ovHeading);
        ovBlock.appendChild(ovBody);

        stateContent.appendChild(topRow);
        stateContent.appendChild(ovBlock);

        // Prerequisites
        if (data.prerequisites && data.prerequisites.length > 0) {
            const preBlock = createEl("div", "content-block");
            const preHeading = createEl("div", "block-heading", "Recommended Prerequisites");
            const ul = createEl("ul", "takeaways-list");
            data.prerequisites.forEach((p) => ul.appendChild(createEl("li", "", p)));
            preBlock.appendChild(preHeading);
            preBlock.appendChild(ul);
            stateContent.appendChild(preBlock);
        }

        // Weekly Schedule Stack
        const scheduleBlock = createEl("div", "content-block");
        const scheduleHeading = createEl("div", "block-heading", "Week-by-Week Curriculum");
        const stack = createEl("div", "curriculum-stack");

        data.weekly_schedule.forEach((week) => {
            const weekCard = createEl("div", "curriculum-week-card");
            const wTitle = createEl("div", "week-badge-title", `Week ${week.week_number}: ${week.title}`);
            weekCard.appendChild(wTitle);

            if (week.focus_concepts && week.focus_concepts.length > 0) {
                const cBlock = createEl("div", "week-meta-block");
                const cLabel = createEl("span", "week-meta-label", "Core Concepts:");
                const cList = createEl("ul", "week-item-list");
                week.focus_concepts.forEach((c) => cList.appendChild(createEl("li", "", c)));
                cBlock.appendChild(cLabel);
                cBlock.appendChild(cList);
                weekCard.appendChild(cBlock);
            }

            if (week.practice_activities && week.practice_activities.length > 0) {
                const aBlock = createEl("div", "week-meta-block");
                const aLabel = createEl("span", "week-meta-label", "Practice Activities:");
                const aList = createEl("ul", "week-item-list");
                week.practice_activities.forEach((a) => aList.appendChild(createEl("li", "", a)));
                aBlock.appendChild(aLabel);
                aBlock.appendChild(aList);
                weekCard.appendChild(aBlock);
            }

            if (week.milestone_question) {
                const mBox = createEl("div", "callout-example", `Milestone Check: ${week.milestone_question}`);
                weekCard.appendChild(mBox);
            }

            stack.appendChild(weekCard);
        });

        scheduleBlock.appendChild(scheduleHeading);
        scheduleBlock.appendChild(stack);
        stateContent.appendChild(scheduleBlock);

        // Capstone Final Project
        if (data.final_project) {
            const projBlock = createEl("div", "content-block");
            const pHeading = createEl("div", "block-heading", "Capstone Mini-Project");
            const pBox = createEl("div", "callout-takeaway", data.final_project);
            projBlock.appendChild(pHeading);
            projBlock.appendChild(pBox);
            stateContent.appendChild(projBlock);
        }

        // Suggested Resource Topics
        if (data.suggested_resources && data.suggested_resources.length > 0) {
            const resBlock = createEl("div", "content-block");
            const rHeading = createEl("div", "block-heading", "Suggested Study Topics & Search Queries");
            const tagsDiv = createEl("div", "resource-tags-cloud");
            data.suggested_resources.forEach((r) => {
                tagsDiv.appendChild(createEl("span", "resource-tag", `🔍 ${r}`));
            });
            resBlock.appendChild(rHeading);
            resBlock.appendChild(tagsDiv);
            stateContent.appendChild(resBlock);
        }
    }

    // ==========================================
    // Copy & Download Actions
    // ==========================================
    btnCopyResult.addEventListener("click", () => {
        if (!currentResultData) return;
        const text = formatPlainTextReport(currentResultData);
        navigator.clipboard.writeText(text).then(
            () => showToast("Copied to clipboard."),
            () => showToast("Failed to copy.")
        );
    });

    btnDownloadResult.addEventListener("click", () => {
        if (!currentResultData) return;
        const text = formatPlainTextReport(currentResultData);
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `EduGenie_${currentResultData.feature}_${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("Report downloaded (.txt)");
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
    // UI Helpers & States
    // ==========================================
    function setLoading(isLoading) {
        isSubmitting = isLoading;
        btnSubmit.disabled = isLoading;
        btnSpinner.classList.toggle("hidden", !isLoading);

        if (isLoading) {
            const meta = TOOL_META[activeFeature] || TOOL_META.qa;
            loadingTitle.textContent = meta.loadingTitle;
            loadingSubtitle.textContent = meta.loadingSubtitle;

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
        setTimeout(() => toast.classList.add("hidden"), 2800);
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

    function formatPlainTextReport(resultObj) {
        const { feature, data } = resultObj;
        let out = `EduGenie — Learning Report\nFeature: ${feature.toUpperCase()}\nDate: ${new Date().toLocaleString()}\n========================================\n\n`;

        if (feature === "qa") {
            out += `Question: ${data.question}\nLevel: ${data.level}\n\nAnswer:\n${data.answer}\n\n`;
            if (data.key_points && data.key_points.length) {
                out += `Key Takeaways:\n${data.key_points.map((p) => `- ${p}`).join("\n")}\n\n`;
            }
            if (data.example) {
                out += `Illustrative Example:\n${data.example}\n\n`;
            }
        } else if (feature === "explain") {
            out += `Topic: ${data.topic}\nLevel: ${data.level}\nProvider: ${data.provider}\n\nExplanation:\n${data.explanation}\n\nAnalogy/Example:\n${data.analogy_or_example}\n\nKey Takeaway:\n${data.takeaway}\n\n`;
        } else if (feature === "quiz") {
            out += `Topic/Passage: ${data.topic_or_passage}\nDifficulty: ${data.difficulty}\n\n`;
            data.questions.forEach((q, i) => {
                out += `Question ${i + 1}: ${q.question}\n`;
                q.options.forEach((opt, idx) => {
                    out += `  [${String.fromCharCode(65 + idx)}] ${opt}\n`;
                });
                out += `Correct Answer: [${String.fromCharCode(65 + q.correct_option_index)}] ${q.options[q.correct_option_index]}\n`;
                out += `Explanation: ${q.explanation}\n\n`;
            });
        } else if (feature === "summarize") {
            out += `Original Words: ${data.original_word_count}\nSummary Words: ${data.summary_word_count}\nLength: ${data.length}\nFormat: ${data.format}\n\nSummary:\n${data.summary}\n\n`;
        } else if (feature === "learning_path") {
            out += `Subject: ${data.topic}\nCurrent Level: ${data.current_level}\nGoal: ${data.goal}\nDuration: ~${data.estimated_duration_weeks} weeks\n\nOverview:\n${data.overview}\n\n`;
            if (data.prerequisites && data.prerequisites.length) {
                out += `Prerequisites:\n${data.prerequisites.map((p) => `- ${p}`).join("\n")}\n\n`;
            }
            out += `Roadmap:\n`;
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
