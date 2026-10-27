
const API_URL = "http://127.0.0.1:8080/api";

// =====================================================
// SHARED HELPERS
// =====================================================

async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        const validationMessage = Array.isArray(result.errors)
            ? result.errors.map(error => error.defaultMessage || error.message).filter(Boolean).join(" ")
            : "";

        throw new Error(
            validationMessage ||
            result.message ||
            result.error ||
            `Request failed: ${response.status}`
        );
    }

    return result;
}

function showMessage(el, message, success = false) {
    if (!el) return;

    el.textContent = message || "";
    el.classList.remove("hidden", "error", "success");

    if (message) {
        el.classList.add(success ? "success" : "error");
    } else {
        el.classList.add("hidden");
    }
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? "";
}

function addText(parent, tag, value, className = "") {
    const el = document.createElement(tag);
    el.textContent = value ?? "";

    if (className) el.className = className;

    parent.appendChild(el);
    return el;
}

function addButton(
    parent,
    label,
    action,
    className = "btn btn-secondary"
) {
    const el = document.createElement("button");

    el.type = "button";
    el.className = className;
    el.textContent = label;
    el.addEventListener("click", action);

    parent.appendChild(el);
    return el;
}

function option(value, label) {
    const el = document.createElement("option");
    el.value = value;
    el.textContent = label;
    return el;
}

function formatStatus(status) {
    return ({
        BACKLOG: "Backlog",
        DOING: "Doing",
        REVIEW: "Review",
        DONE: "Done"
    })[status] || status || "Unknown";
}

function assigneeId(task) {
    return task?.assigneeId ?? task?.assignee?.id ?? null;
}

function assigneeName(task) {
    return task?.assigneeName ?? task?.assignee?.name ?? "";
}

function isAdmin() {
    return currentUser?.role === "ADMIN";
}

function isFaculty() {
    return currentUser?.role === "FACULTY";
}

function isMember() {
    return currentUser?.role === "MEMBER";
}

function isAssignedMember(task) {
    return (
        isMember() &&
        assigneeId(task) != null &&
        String(assigneeId(task)) === String(currentUser?.id)
    );
}

// =====================================================
// INDIVIDUAL MEMBER REGISTRATION
// =====================================================

const registerForm = document.getElementById("registerForm");

if (registerForm) {
    registerForm.addEventListener("submit", async event => {
        event.preventDefault();

        const message = document.getElementById("registerError");
        const button = document.getElementById("registerButton");

        const name = document.getElementById("name")?.value.trim() || "";
        const email = document.getElementById("email")?.value.trim() || "";
        const password = document.getElementById("password")?.value || "";

        showMessage(message, "");

        if (!name || !email || password.length < 6) {
            showMessage(
                message,
                "Enter your name, valid email, and password of at least 6 characters."
            );
            return;
        }

        if (button) {
            button.disabled = true;
            button.textContent = "Creating account...";
        }

        try {
            const user = await apiRequest("/auth/register", {
                method: "POST",
                body: JSON.stringify({ name, email, password })
            });

            showMessage(
                message,
                `Account created for ${user.name || name}. You can now sign in.`,
                true
            );

            registerForm.reset();

            window.setTimeout(() => {
                window.location.href = "index.html";
            }, 1500);
        } catch (error) {
            showMessage(message, error.message);
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = "Create account";
            }
        }
    });
}

// =====================================================
// FACULTY REGISTRATION
// =====================================================

const facultyRegisterForm =
    document.getElementById("facultyRegisterForm");

if (facultyRegisterForm) {
    facultyRegisterForm.addEventListener("submit", async event => {
        event.preventDefault();

        const message =
            document.getElementById("facultyRegisterMessage");

        const button =
            document.getElementById("facultyRegisterButton");

        const name =
            document.getElementById("facultyName")?.value.trim() || "";

        const email =
            document.getElementById("facultyEmail")?.value.trim() || "";

        const password =
            document.getElementById("facultyPassword")?.value || "";

        showMessage(message, "");

        if (!name || !email || password.length < 6) {
            showMessage(
                message,
                "Enter your name, valid email, and password of at least 6 characters."
            );
            return;
        }

        if (button) {
            button.disabled = true;
            button.textContent = "Submitting...";
        }

        try {
            const result = await apiRequest("/auth/register-faculty", {
                method: "POST",
                body: JSON.stringify({ name, email, password })
            });

            showMessage(
                message,
                result.message ||
                    "Registration submitted. Wait for Admin approval.",
                true
            );

            facultyRegisterForm.reset();
        } catch (error) {
            showMessage(message, error.message);
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = "Submit registration";
            }
        }
    });
}

// =====================================================
// LOGIN
// =====================================================

const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async event => {
        event.preventDefault();

        const message = document.getElementById("loginError");
        const button = document.getElementById("loginButton");

        const email =
            document.getElementById("email")?.value.trim() || "";

        const password =
            document.getElementById("password")?.value || "";

        showMessage(message, "");

        if (button) {
            button.disabled = true;
            button.textContent = "Signing in...";
        }

        try {
            await apiRequest("/auth/login", {
                method: "POST",
                body: JSON.stringify({ email, password })
            });

            await apiRequest("/auth/me");

            window.location.replace("dashboard.html");
        } catch (error) {
            showMessage(
                message,
                error.message ||
                    "Unable to sign in. Check your credentials."
            );
        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML = 'Sign in <span>→</span>';
            }
        }
    });
}

document.querySelectorAll(".demo-fill").forEach(button => {
    button.addEventListener("click", () => {
        const email = document.getElementById("email");
        const password = document.getElementById("password");

        if (email && password) {
            email.value = button.dataset.email || "";
            password.value = button.dataset.password || "";
        }
    });
});

// =====================================================
// DASHBOARD STATE AND CURRENT USER
// =====================================================

let currentUser = null;
let kanbanTasks = [];

async function loadCurrentUser() {
    try {
        currentUser = await apiRequest("/auth/me");

        setText(
            "userName",
            currentUser.name || currentUser.email || "User"
        );

        setText("userRole", currentUser.role || "MEMBER");

        setText(
            "userAvatar",
            (currentUser.name || currentUser.email || "U")
                .charAt(0)
                .toUpperCase()
        );

        const facultyNav = document.getElementById("facultyNav");

        if (facultyNav) {
            facultyNav.classList.toggle("hidden", !isAdmin());
        }

        const newTask = document.getElementById("newTaskButton");

        if (newTask) {
            newTask.classList.toggle("hidden", !isFaculty());
            newTask.disabled = !isFaculty();
        }

        if (isAdmin()) {
            await updatePendingFacultyCount();
        }

        return true;
    } catch (error) {
        console.error("Could not load current user:", error);
        window.location.replace("index.html");
        return false;
    }
}

// =====================================================
// ADMIN: FACULTY REGISTRATION APPROVAL
// =====================================================

const pendingFacultyList =
    document.getElementById("pendingFacultyList");

const pendingFacultyMessage =
    document.getElementById("pendingFacultyMessage");

const refreshFacultyButton =
    document.getElementById("refreshFacultyButton");

async function updatePendingFacultyCount() {
    const el = document.getElementById("pendingFacultyCount");

    if (!el || !isAdmin()) return;

    try {
        const users = await apiRequest("/users/pending-faculty");
        el.textContent = Array.isArray(users) ? users.length : 0;
    } catch (error) {
        console.warn(error.message);
    }
}

async function loadPendingFaculty() {
    if (!pendingFacultyList || !isAdmin()) return;

    pendingFacultyList.replaceChildren();

    showMessage(
        pendingFacultyMessage,
        "Loading pending registrations..."
    );

    try {
        const users = await apiRequest("/users/pending-faculty");

        pendingFacultyList.replaceChildren();

        if (!Array.isArray(users) || !users.length) {
            showMessage(
                pendingFacultyMessage,
                "There are no pending faculty registrations.",
                true
            );

            setText("pendingFacultyCount", "0");
            return;
        }

        showMessage(
            pendingFacultyMessage,
            `${users.length} registration(s) awaiting approval.`,
            true
        );

        setText("pendingFacultyCount", users.length);

        users.forEach(user => {
            const card = document.createElement("article");
            card.className = "task-card faculty-pending-card";

            addText(card, "h4", user.name, "task-card-title");
            addText(card, "p", user.email);
            addText(card, "p", "Status: Pending Admin approval");

            const button = addButton(
                card,
                "Approve faculty",
                async () => {
                    if (!confirm(`Approve faculty account for ${user.name}?`)) {
                        return;
                    }

                    button.disabled = true;
                    button.textContent = "Approving...";

                    try {
                        await apiRequest(
                            `/users/${encodeURIComponent(user.id)}/approve`,
                            { method: "PATCH" }
                        );

                        await loadPendingFaculty();
                        alert(`${user.name} has been approved.`);
                    } catch (error) {
                        showMessage(
                            pendingFacultyMessage,
                            error.message
                        );

                        button.disabled = false;
                        button.textContent = "Approve faculty";
                    }
                },
                "btn btn-primary"
            );

            pendingFacultyList.appendChild(card);
        });
    } catch (error) {
        showMessage(
            pendingFacultyMessage,
            `Could not load pending faculty: ${error.message}`
        );
    }
}

if (refreshFacultyButton) {
    refreshFacultyButton.addEventListener("click", loadPendingFaculty);
}

// =====================================================
// NAVIGATION
// =====================================================

const navButtons = document.querySelectorAll(".nav-item[data-view]");

const views = {
    board: document.getElementById("boardView"),
    analytics: document.getElementById("analyticsView"),
    team: document.getElementById("teamView"),
    faculty: document.getElementById("facultyView")
};

const viewTitles = {
    board: "Kanban board",
    analytics: "Analytics",
    team: "Team management",
    faculty: "Faculty approval"
};

navButtons.forEach(button => {
    button.addEventListener("click", async () => {
        const name = button.dataset.view;

        if (!views[name]) return;
        if (name === "faculty" && !isAdmin()) return;

        navButtons.forEach(item => item.classList.remove("active"));
        button.classList.add("active");

        Object.values(views).forEach(view => {
            view?.classList.remove("active");
        });

        views[name].classList.add("active");
        setText("pageTitle", viewTitles[name] || name);

        if (name === "faculty") {
            await loadPendingFaculty();
        }

        if (name === "analytics") {
            await loadKanbanAnalytics();
        }

        if (name === "team") {
            await loadTeamUsers();
        }

        if (name === "board") {
            await loadDashboard();
        }

        document.getElementById("sidebar")?.classList.remove("open");

        document.getElementById("mobileMenu")
            ?.setAttribute("aria-expanded", "false");
    });
});

const mobileMenu = document.getElementById("mobileMenu");

if (mobileMenu) {
    mobileMenu.addEventListener("click", () => {
        const sidebar = document.getElementById("sidebar");

        sidebar?.classList.toggle("open");

        mobileMenu.setAttribute(
            "aria-expanded",
            sidebar?.classList.contains("open") ? "true" : "false"
        );
    });
}

// =====================================================
// TEAM MANAGEMENT
// =====================================================

async function loadTeamUsers() {
    const table = document.getElementById("teamTable");
    if (!table) return;

    table.replaceChildren();

    if (!isAdmin() && !isFaculty()) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 3;
        cell.textContent =
            "Workspace user details are available to Admin and Faculty.";

        row.appendChild(cell);
        table.appendChild(row);
        return;
    }

    try {
        const users = await apiRequest("/users");

        if (!Array.isArray(users) || users.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 3;
            cell.textContent = "No workspace users found.";

            row.appendChild(cell);
            table.appendChild(row);
            return;
        }

        users.forEach(user => {
            const row = document.createElement("tr");

            addText(row, "td", user.name || "—");
            addText(row, "td", user.email || "—");
            addText(row, "td", user.role || "—");

            table.appendChild(row);
        });
    } catch (error) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 3;
        cell.textContent = `Could not load workspace users: ${error.message}`;

        row.appendChild(cell);
        table.appendChild(row);
    }
}

// =====================================================
// LOGOUT
// =====================================================

const logoutButton = document.getElementById("logoutButton");

if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
        try {
            await apiRequest("/auth/logout", { method: "POST" });
        } catch (error) {
            console.warn("Logout failed:", error.message);
        } finally {
            window.location.href = "index.html";
        }
    });
}

// =====================================================
// TASK CREATE / EDIT DIALOG
// =====================================================

const newTaskButton = document.getElementById("newTaskButton");
const taskDialog = document.getElementById("taskDialog");
const taskForm = document.getElementById("taskForm");
const closeTaskDialog = document.getElementById("closeTaskDialog");
const cancelTaskButton = document.getElementById("cancelTaskButton");
const taskFormError = document.getElementById("taskFormError");
const saveTaskButton = document.getElementById("saveTaskButton");
const taskAssignee = document.getElementById("taskAssignee");
const taskDueDate = document.getElementById("taskDueDate");

function showTaskError(message) {
    if (!taskFormError) {
        alert(message);
        return;
    }

    taskFormError.textContent = message;
    taskFormError.classList.remove("hidden");
    taskFormError.classList.add("error");
}

async function loadTaskAssignees(selectedId = "") {
    if (!taskAssignee) return;

    taskAssignee.replaceChildren();
    taskAssignee.appendChild(option("", "Unassigned"));

    try {
        if (isFaculty() || isAdmin()) {
            const users = await apiRequest("/users");

            const members = users.filter(
                user =>
                    user.role === "MEMBER" &&
                    user.approved !== false
            );

            members.forEach(user => {
                taskAssignee.appendChild(
                    option(String(user.id), user.name)
                );
            });
        } else if (currentUser) {
            taskAssignee.appendChild(
                option(String(currentUser.id), currentUser.name)
            );
        }

        if (selectedId !== "" && selectedId != null) {
            taskAssignee.value = String(selectedId);
        }
    } catch (error) {
        showTaskError("Could not load members: " + error.message);
    }
}

function resetTaskForm() {
    taskForm?.reset();

    setText("taskDialogTitle", "Create a task");

    if (saveTaskButton) {
        saveTaskButton.textContent = "Save task";
    }

    const id = document.getElementById("taskId");
    if (id) id.value = "";

    if (taskDueDate) {
        taskDueDate.disabled = false;
        taskDueDate.readOnly = false;
    }

    if (taskAssignee) {
        taskAssignee.disabled = false;
    }

    showMessage(taskFormError, "");
}

if (newTaskButton && taskDialog) {
    newTaskButton.addEventListener("click", async () => {
        if (!isFaculty()) return;

        resetTaskForm();
        taskDialog.showModal();

        await loadTaskAssignees();
    });
}

if (closeTaskDialog && taskDialog) {
    closeTaskDialog.addEventListener("click", () => {
        taskDialog.close();
    });
}

if (cancelTaskButton && taskDialog) {
    cancelTaskButton.addEventListener("click", () => {
        taskDialog.close();
    });
}

async function editTask(task) {
    if (isAdmin() || (!isFaculty() && !isAssignedMember(task))) {
        alert(
            "Only Faculty or the member assigned to this task can edit it."
        );
        return;
    }

    if (!taskDialog || !taskForm) return;

    showMessage(taskFormError, "");

    try {
        await loadTaskAssignees(assigneeId(task) ?? "");

        const fields = {
            taskId: task.id,
            taskTitle: task.title || "",
            taskDescription: task.description || "",
            taskPriority: task.priority || "MEDIUM",
            taskStatus: task.status || "BACKLOG"
        };

        Object.entries(fields).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.value = value;
        });

        if (taskDueDate) {
            taskDueDate.value = task.dueDate || "";
        }

        if (taskAssignee) {
            taskAssignee.disabled = !isFaculty();
        }

        setText("taskDialogTitle", "Edit task");

        if (saveTaskButton) {
            saveTaskButton.textContent = "Save changes";
        }

        taskDialog.showModal();
    } catch (error) {
        showTaskError(error.message);
    }
}

if (taskForm) {
    taskForm.addEventListener("submit", async event => {
        event.preventDefault();
        showMessage(taskFormError, "");

        const title =
            document.getElementById("taskTitle")?.value.trim() || "";

        const description =
            document.getElementById("taskDescription")?.value.trim() || "";

        const priority =
            document.getElementById("taskPriority")?.value || "MEDIUM";

        const dueDate =
            document.getElementById("taskDueDate")?.value || "";

        const taskId =
            document.getElementById("taskId")?.value || "";

        if (!title) {
            showTaskError("Enter a task title.");
            return;
        }

        if (!isFaculty() && !taskId) {
            showTaskError("Only Faculty can create tasks.");
            return;
        }

        const data = {
            title,
            description,
            priority,
            dueDate: dueDate || null,
            status: taskId
                ? (
                    document.getElementById("taskStatus")?.value ||
                    "BACKLOG"
                )
                : "BACKLOG",
            assigneeId:
                isFaculty() && taskAssignee?.value
                    ? Number(taskAssignee.value)
                    : null
        };

        if (saveTaskButton) {
            saveTaskButton.disabled = true;
            saveTaskButton.textContent = "Saving...";
        }

        try {
            await apiRequest(
                taskId
                    ? `/tasks/${encodeURIComponent(taskId)}`
                    : "/tasks",
                {
                    method: taskId ? "PUT" : "POST",
                    body: JSON.stringify(data)
                }
            );

            taskDialog.close();
            resetTaskForm();

            await loadDashboard();
        } catch (error) {
            showTaskError("Could not save task: " + error.message);
        } finally {
            if (saveTaskButton) {
                saveTaskButton.disabled = false;
                saveTaskButton.textContent = "Save task";
            }
        }
    });
}

// =====================================================
// KANBAN BOARD
// =====================================================

const boardPage = document.getElementById("kanbanBoard");

const columns = {
    BACKLOG: "listBacklog",
    DOING: "listDoing",
    REVIEW: "listReview",
    DONE: "listDone"
};

const countIds = {
    BACKLOG: "countBacklog",
    DOING: "countDoing",
    REVIEW: "countReview",
    DONE: "countDone"
};

async function loadDashboard() {
    if (!boardPage) return;

    try {
        const tasks = await apiRequest("/tasks");

        if (!Array.isArray(tasks)) {
            throw new Error("Unexpected tasks response.");
        }

        kanbanTasks = tasks;

        const errorBox = document.getElementById("boardErrorMessage");
        errorBox?.remove();

        renderKanbanBoard();
        renderStatusChart();

        await loadKanbanAnalytics();
    } catch (error) {
        console.error(error);
        showBoardMessage("Could not load tasks: " + error.message);
    }
}

function showBoardMessage(message) {
    const board = document.getElementById("kanbanBoard");
    if (!board) return;

    let box = document.getElementById("boardErrorMessage");

    if (!box) {
        box = document.createElement("p");
        box.id = "boardErrorMessage";
        box.className = "message error";

        board.parentElement?.insertBefore(box, board);
    }

    box.textContent = message;
}

function renderKanbanBoard() {
    Object.values(columns).forEach(id => {
        document.getElementById(id)?.replaceChildren();
    });

    const totals = {
        BACKLOG: 0,
        DOING: 0,
        REVIEW: 0,
        DONE: 0
    };

    kanbanTasks.forEach(task => {
        const list = document.getElementById(columns[task.status]);
        if (!list) return;

        if (Object.hasOwn(totals, task.status)) {
            totals[task.status]++;
        }

        renderTaskCard(task, list);
    });

    Object.entries(countIds).forEach(([status, id]) => {
        setText(id, totals[status]);
    });

    setText("statTotal", kanbanTasks.length);
    setText("statDoing", totals.DOING);
    setText("statReview", totals.REVIEW);
    setText("statDone", totals.DONE);
}

function renderTaskCard(task, list) {
    const card = document.createElement("article");
    card.className = "task-card";

    addText(card, "h4", task.title, "task-card-title");

    if (task.description) {
        addText(card, "p", task.description, "task-card-description");
    }

    const details = document.createElement("div");
    details.className = "task-card-details";

    addText(
        details,
        "span",
        `Priority: ${task.priority || "MEDIUM"}`
    );

    addText(
        details,
        "span",
        `Assigned: ${assigneeName(task) || "Unassigned"}`
    );

    if (task.dueDate) {
        addText(details, "span", `Due: ${task.dueDate}`);
    }

    card.appendChild(details);

    // Show whether evidence has been submitted.
    if (task.status === "REVIEW" || task.status === "DONE") {
        const evidenceStatus = task.evidence
            ? "Evidence submitted"
            : "No evidence recorded";

        addText(
            card,
            "p",
            evidenceStatus,
            task.evidence ? "evidence-status" : "muted"
        );
    }

    const actions = document.createElement("div");
    actions.className = "task-card-actions";

    if (isFaculty() || isAssignedMember(task)) {
        addButton(actions, "Edit", () => editTask(task));
    }

    if (isAssignedMember(task) && task.status === "BACKLOG") {
        addButton(
            actions,
            "Start task",
            () => changeTaskStatus(task.id, "DOING")
        );
    }

    // IMPORTANT:
    // Do not move a task directly from DOING to REVIEW.
    // The member must submit evidence first.
    if (isAssignedMember(task) && task.status === "DOING") {
        addButton(
            actions,
            "Submit for Review",
            () => openEvidenceDialog(task),
            "btn btn-primary"
        );
    }

    // Evidence remains available to the member while the task is in review.
    if (
        isAssignedMember(task) &&
        (task.status === "REVIEW" || task.status === "DONE") &&
        task.evidence
    ) {
        addButton(
            actions,
            "View submitted evidence",
            () => viewMemberEvidence(task)
        );
    }

    if (isFaculty() && task.status === "REVIEW") {
        addButton(
            actions,
            "Review task",
            () => openReviewDialog(task),
            "btn btn-primary"
        );
    }

    if (actions.childElementCount) {
        card.appendChild(actions);
    }

    list.appendChild(card);
}

async function changeTaskStatus(id, status) {
    try {
        await apiRequest(
            `/tasks/${encodeURIComponent(id)}/status`,
            {
                method: "PATCH",
                body: JSON.stringify({ status })
            }
        );

        await loadDashboard();
    } catch (error) {
        alert("Could not change task status: " + error.message);
    }
}

// =====================================================
// MEMBER EVIDENCE SUBMISSION
// =====================================================

const evidenceDialog = document.getElementById("evidenceDialog");
const evidenceForm = document.getElementById("evidenceForm");
const closeEvidenceDialog =
    document.getElementById("closeEvidenceDialog");
const cancelEvidenceButton =
    document.getElementById("cancelEvidenceButton");
const evidenceFormError =
    document.getElementById("evidenceFormError");
const submitEvidenceButton =
    document.getElementById("submitEvidenceButton");

let activeEvidenceTask = null;

function openEvidenceDialog(task) {
    if (!isAssignedMember(task)) {
        alert("Only the member assigned to this task can submit evidence.");
        return;
    }

    if (task.status !== "DOING") {
        alert("Only tasks in Doing can be submitted for review.");
        return;
    }

    if (!evidenceDialog || !evidenceForm) {
        alert("The evidence submission dialog was not found.");
        return;
    }

    activeEvidenceTask = task;

    const taskId = document.getElementById("evidenceTaskId");
    const evidenceInput = document.getElementById("taskEvidence");

    if (taskId) taskId.value = task.id;

    setText("evidenceTaskTitle", task.title || "Untitled task");

    // If a previous submission exists, prefill it for editing.
    if (evidenceInput) {
        evidenceInput.value = task.evidence || "";
    }

    showMessage(evidenceFormError, "");

    if (submitEvidenceButton) {
        submitEvidenceButton.disabled = false;
        submitEvidenceButton.textContent = "Submit for Review";
    }

    evidenceDialog.showModal();
}

function closeEvidenceSubmissionDialog() {
    evidenceDialog?.close();
}

if (closeEvidenceDialog) {
    closeEvidenceDialog.addEventListener(
        "click",
        closeEvidenceSubmissionDialog
    );
}

if (cancelEvidenceButton) {
    cancelEvidenceButton.addEventListener(
        "click",
        closeEvidenceSubmissionDialog
    );
}

if (evidenceForm) {
    evidenceForm.addEventListener("submit", async event => {
        event.preventDefault();

        showMessage(evidenceFormError, "");

        const id =
            document.getElementById("evidenceTaskId")?.value || "";

        const evidence =
            document.getElementById("taskEvidence")?.value.trim() || "";

        if (!id) {
            showMessage(evidenceFormError, "Task ID is missing.");
            return;
        }

        if (!evidence) {
            showMessage(
                evidenceFormError,
                "Please enter your evidence before submitting."
            );
            return;
        }

        if (evidence.length > 5000) {
            showMessage(
                evidenceFormError,
                "Evidence cannot exceed 5000 characters."
            );
            return;
        }

        const task = kanbanTasks.find(
            item => String(item.id) === String(id)
        );

        if (!task || !isAssignedMember(task)) {
            showMessage(
                evidenceFormError,
                "You are not assigned to this task."
            );
            return;
        }

        if (task.status !== "DOING") {
            showMessage(
                evidenceFormError,
                "This task is no longer in Doing. Refresh the board and try again."
            );
            return;
        }

        if (submitEvidenceButton) {
            submitEvidenceButton.disabled = true;
            submitEvidenceButton.textContent = "Submitting...";
        }

        try {
            // The backend saves the evidence and moves the task to REVIEW.
            await apiRequest(
                `/tasks/${encodeURIComponent(id)}/submit-review`,
                {
                    method: "POST",
                    body: JSON.stringify({ evidence })
                }
            );

            evidenceDialog?.close();

            await loadDashboard();

            alert(
                "Evidence submitted successfully. Your task is now waiting for Faculty review."
            );
        } catch (error) {
            showMessage(
                evidenceFormError,
                "Could not submit evidence: " + error.message
            );
        } finally {
            if (submitEvidenceButton) {
                submitEvidenceButton.disabled = false;
                submitEvidenceButton.textContent = "Submit for Review";
            }
        }
    });
}

function viewMemberEvidence(task) {
    const evidence = task.evidence || "No evidence has been submitted.";

    alert(
        `Evidence for: ${task.title || "Task"}\n\n${evidence}`
    );
}

// =====================================================
// FACULTY TASK REVIEW
// =====================================================

const reviewDialog = document.getElementById("reviewDialog");
const reviewForm = document.getElementById("reviewForm");
const closeReviewDialog = document.getElementById("closeReviewDialog");
const requestChangesButton =
    document.getElementById("requestChangesButton");

function openReviewDialog(task) {
    if (!isFaculty()) {
        alert("Only Faculty can review tasks.");
        return;
    }

    if (task.status !== "REVIEW") {
        alert("Only tasks waiting for review can be reviewed.");
        return;
    }

    if (!reviewDialog) {
        alert("Review dialog was not found.");
        return;
    }

    const id = document.getElementById("reviewTaskId");
    const comment = document.getElementById("reviewComment");
    const evidenceDisplay = document.getElementById("reviewEvidence");

    if (id) id.value = task.id;
    if (comment) comment.value = "";

    setText("reviewTaskTitle", task.title || "Untitled task");

    // Use textContent, not innerHTML, to display member-submitted text safely.
    if (evidenceDisplay) {
        evidenceDisplay.textContent =
            task.evidence?.trim() ||
            "No evidence was submitted for this task.";
    }

    reviewDialog.showModal();
}

if (closeReviewDialog && reviewDialog) {
    closeReviewDialog.addEventListener("click", () => {
        reviewDialog.close();
    });
}

async function submitTaskReview(decision) {
    if (!isFaculty()) {
        alert("Only Faculty can review tasks.");
        return;
    }

    const id =
        document.getElementById("reviewTaskId")?.value || "";

    const comment =
        document.getElementById("reviewComment")?.value.trim() || "";

    if (!id) {
        alert("Task ID is missing.");
        return;
    }

    if (decision === "CHANGES" && !comment) {
        alert("Enter a comment explaining what changes are required.");
        document.getElementById("reviewComment")?.focus();
        return;
    }

    const task = kanbanTasks.find(
        item => String(item.id) === String(id)
    );

    if (!task || task.status !== "REVIEW") {
        alert("This task is no longer waiting for review. Refresh the board.");
        return;
    }

    const approveButton = reviewForm?.querySelector(
        'button[type="submit"]'
    );

    if (approveButton) approveButton.disabled = true;
    if (requestChangesButton) requestChangesButton.disabled = true;

    try {
        await apiRequest(
            `/tasks/${encodeURIComponent(id)}/review`,
            {
                method: "POST",
                body: JSON.stringify({ decision, comment })
            }
        );

        reviewDialog?.close();

        await loadDashboard();

        alert(
            decision === "APPROVE"
                ? "Task approved and moved to Done."
                : "Changes requested. The task has been returned to Doing."
        );
    } catch (error) {
        alert("Review failed: " + error.message);
    } finally {
        if (approveButton) approveButton.disabled = false;
        if (requestChangesButton) requestChangesButton.disabled = false;
    }
}

if (reviewForm) {
    reviewForm.addEventListener("submit", async event => {
        event.preventDefault();
        await submitTaskReview("APPROVE");
    });
}

if (requestChangesButton) {
    requestChangesButton.addEventListener("click", async () => {
        await submitTaskReview("CHANGES");
    });
}

// =====================================================
// ANALYTICS
// =====================================================

async function loadKanbanAnalytics() {
    try {
        const data = await apiRequest("/analytics");

        setText("statTotal", data.totalTasks ?? kanbanTasks.length);
        setText("statDoing", data.workInProgress ?? 0);
        setText("statReview", data.waitingForReview ?? 0);
        setText("statDone", data.done ?? 0);

        setText("overdueTasks", data.overdueTasks ?? 0);
        setText("throughput", data.throughput30Days ?? 0);

        setText(
            "completionRate",
            `${data.completionRate ?? 0}%`
        );

        setText(
            "cycleTime",
            data.averageCycleTimeDays != null
                ? `${data.averageCycleTimeDays} days`
                : "—"
        );

        setText("wipValue", data.workInProgress ?? 0);
        setText("reviewValue", data.waitingForReview ?? 0);

        const total = Number(data.totalTasks) || 0;
        const wip = Number(data.workInProgress) || 0;
        const review = Number(data.waitingForReview) || 0;

        const wipBar = document.getElementById("wipBar");
        const reviewBar = document.getElementById("reviewBar");

        if (wipBar) {
            wipBar.style.width =
                `${total ? Math.min(100, wip / total * 100) : 0}%`;
        }

        if (reviewBar) {
            reviewBar.style.width =
                `${total ? Math.min(100, review / total * 100) : 0}%`;
        }

        renderStatusChart();
    } catch (error) {
        console.warn(
            "Analytics could not be loaded:",
            error.message
        );
    }
}

function renderStatusChart() {
    const chart = document.getElementById("statusChart");
    if (!chart) return;

    chart.replaceChildren();

    const counts = {
        BACKLOG: 0,
        DOING: 0,
        REVIEW: 0,
        DONE: 0
    };

    kanbanTasks.forEach(task => {
        if (Object.hasOwn(counts, task.status)) {
            counts[task.status]++;
        }
    });

    const max = Math.max(1, ...Object.values(counts));

    Object.entries(counts).forEach(([status, count]) => {
        const row = document.createElement("div");
        row.className = "chart-row";

        addText(row, "span", formatStatus(status));

        const track = document.createElement("div");
        track.className = "progress-track";

        const fill = document.createElement("div");
        fill.className = "progress-fill";
        fill.style.width = `${count / max * 100}%`;

        track.appendChild(fill);
        row.appendChild(track);

        addText(row, "strong", count);

        chart.appendChild(row);
    });
}

// =====================================================
// REFRESH AND INITIALIZATION
// =====================================================

const refreshButton = document.getElementById("refreshButton");

if (refreshButton) {
    refreshButton.addEventListener("click", loadDashboard);
}

const analyticsRefresh = document.getElementById("analyticsRefresh");

if (analyticsRefresh) {
    analyticsRefresh.addEventListener("click", loadDashboard);
}

if (boardPage) {
    (async () => {
        if (!await loadCurrentUser()) return;

        await loadDashboard();
    })();
}
