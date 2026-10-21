
const API_URL = "http://127.0.0.1:8080/api";

// =====================================================
// COMMON HELPERS
// =====================================================

function showMessage(element, message, success = false) {
    if (!element) return;
    element.textContent = message;
    element.classList.remove("hidden", "error", "success");
    if (message) element.classList.add(success ? "success" : "error");
    else element.classList.add("hidden");
}

async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...options.headers
        }
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            result.message || result.error || `Request failed: ${response.status}`
        );
    }

    return result;
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value ?? "";
}

function addText(parent, tag, text, className = "") {
    const element = document.createElement(tag);
    element.textContent = text ?? "";
    if (className) element.className = className;
    parent.appendChild(element);
    return element;
}

function addActionButton(parent, label, action, className = "btn btn-secondary") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", action);
    parent.appendChild(button);
    return button;
}

function formatStatus(status) {
    return ({
        BACKLOG: "Backlog",
        DOING: "Doing",
        REVIEW: "Review",
        DONE: "Done"
    })[status] || status || "Unknown";
}

function getTaskTeamId(task) {
    return task?.teamId ?? task?.team?.id ?? null;
}

function getTaskAssigneeId(task) {
    return task?.assigneeId ?? task?.assignee?.id ?? null;
}

function getTaskAssigneeName(task) {
    return task?.assigneeName ?? task?.assignee?.name ?? "";
}

function getTaskCreatorId(task) {
    return task?.createdById ?? task?.createdBy?.id ?? null;
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

function escapeText(value) {
    return String(value ?? "");
}

// =====================================================
// MEMBER REGISTRATION
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
            showMessage(message, "Enter your name, a valid email, and a password of at least 6 characters.");
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

            showMessage(message, `Account created for ${user.name}. Redirecting to sign in...`, true);
            registerForm.reset();

            window.setTimeout(() => {
                window.location.href = "index.html";
            }, 1000);
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

const facultyRegisterForm = document.getElementById("facultyRegisterForm");

if (facultyRegisterForm) {
    facultyRegisterForm.addEventListener("submit", async event => {
        event.preventDefault();

        const message = document.getElementById("facultyRegisterMessage");
        const button = document.getElementById("facultyRegisterButton");
        const name = document.getElementById("facultyName")?.value.trim() || "";
        const email = document.getElementById("facultyEmail")?.value.trim() || "";
        const password = document.getElementById("facultyPassword")?.value || "";

        showMessage(message, "");

        if (!name || !email || password.length < 6) {
            showMessage(message, "Enter your name, a valid email, and a password of at least 6 characters.");
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
                result.message || "Registration submitted. Please wait for Admin approval.",
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
        const email = document.getElementById("email")?.value.trim() || "";
        const password = document.getElementById("password")?.value || "";

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
            showMessage(message, error.message || "Unable to sign in. Check your credentials.");
        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML = 'Sign in <span>→</span>';
            }
        }
    });
}

// =====================================================
// DEMO ACCOUNT BUTTONS
// =====================================================

document.querySelectorAll(".demo-fill").forEach(button => {
    button.addEventListener("click", () => {
        const emailInput = document.getElementById("email");
        const passwordInput = document.getElementById("password");

        if (emailInput && passwordInput) {
            emailInput.value = button.dataset.email || "";
            passwordInput.value = button.dataset.password || "";
        }
    });
});

// =====================================================
// GLOBAL DASHBOARD STATE
// =====================================================

let currentUser = null;
let kanbanTasks = [];
let kanbanTeams = [];
let workspaceUsers = [];

async function loadCurrentUser() {
    try {
        currentUser = await apiRequest("/auth/me");

        setText("userName", currentUser.name || currentUser.email || "User");
        setText("userRole", currentUser.role || "Member");
        setText(
            "userAvatar",
            (currentUser.name || currentUser.email || "U").charAt(0).toUpperCase()
        );

        // Faculty approval is an Admin-only feature.
        const facultyNav = document.getElementById("facultyNav");
        if (facultyNav) facultyNav.classList.toggle("hidden", !isAdmin());

        // Team creation is displayed for members and Admin.
        // The backend must allow the matching roles as well.
        const createTeamPanel = document.getElementById("createTeamPanel");
        if (createTeamPanel) {
            createTeamPanel.hidden = !(isAdmin() || isMember());
        }

        const createTeamHeading = createTeamPanel?.querySelector("h3");
        if (createTeamHeading && isMember()) {
            createTeamHeading.textContent = "Create Your Project Team";
        }

        const createTeamDescription = createTeamPanel?.querySelector(".create-team-title p");
        if (createTeamDescription && isMember()) {
            createTeamDescription.textContent =
                "Create your project team, select its members and choose an approved faculty guide.";
        }

        const createTeamButton = document.getElementById("createTeamButton");
        if (createTeamButton && isMember()) {
            createTeamButton.textContent = "Create Team";
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
// FACULTY APPROVAL — ADMIN ONLY
// =====================================================

const pendingFacultyList = document.getElementById("pendingFacultyList");
const pendingFacultyMessage = document.getElementById("pendingFacultyMessage");
const refreshFacultyButton = document.getElementById("refreshFacultyButton");

async function updatePendingFacultyCount() {
    const countElement = document.getElementById("pendingFacultyCount");
    if (!countElement || !isAdmin()) return;

    try {
        const faculty = await apiRequest("/users/pending-faculty");
        countElement.textContent = Array.isArray(faculty) ? faculty.length : 0;
    } catch (error) {
        console.warn("Could not get pending faculty count:", error.message);
    }
}

async function loadPendingFaculty() {
    if (!pendingFacultyList || !isAdmin()) return;

    pendingFacultyList.replaceChildren();
    showMessage(pendingFacultyMessage, "Loading pending registrations...");

    try {
        const faculty = await apiRequest("/users/pending-faculty");
        pendingFacultyList.replaceChildren();

        if (!Array.isArray(faculty) || faculty.length === 0) {
            showMessage(pendingFacultyMessage, "There are no pending faculty registrations.", true);
            setText("pendingFacultyCount", "0");
            return;
        }

        showMessage(
            pendingFacultyMessage,
            `${faculty.length} registration(s) awaiting approval.`,
            true
        );
        setText("pendingFacultyCount", faculty.length);

        faculty.forEach(user => {
            const card = document.createElement("article");
            card.className = "task-card faculty-pending-card";

            addText(card, "h4", user.name, "task-card-title");
            addText(card, "p", user.email, "task-card-description");
            addText(card, "p", "Status: Pending Admin approval");

            const button = addActionButton(card, "Approve faculty", async () => {
                if (!window.confirm(`Approve faculty account for ${user.name}?`)) return;

                button.disabled = true;
                button.textContent = "Approving...";

                try {
                    await apiRequest(`/users/${encodeURIComponent(user.id)}/approve`, {
                        method: "PATCH"
                    });

                    await loadPendingFaculty();
                    await loadTeamMembers();

                    window.alert(`${user.name} has been approved and can now sign in.`);
                } catch (error) {
                    showMessage(pendingFacultyMessage, `Approval failed: ${error.message}`);
                    button.disabled = false;
                    button.textContent = "Approve faculty";
                }
            }, "btn btn-primary");

            pendingFacultyList.appendChild(card);
        });
    } catch (error) {
        showMessage(pendingFacultyMessage, `Could not load pending faculty: ${error.message}`);
    }
}

if (refreshFacultyButton) {
    refreshFacultyButton.addEventListener("click", loadPendingFaculty);
}

// =====================================================
// NAVIGATION
// =====================================================

const navButtons = document.querySelectorAll(".nav-item[data-view]");

const dashboardViews = {
    board: document.getElementById("boardView"),
    analytics: document.getElementById("analyticsView"),
    team: document.getElementById("teamView"),
    faculty: document.getElementById("facultyView")
};

const dashboardTitles = {
    board: "Kanban board",
    analytics: "Analytics",
    team: "Team management",
    faculty: "Faculty approval"
};

navButtons.forEach(button => {
    button.addEventListener("click", async () => {
        const selectedView = button.dataset.view;
        if (!dashboardViews[selectedView]) return;
        if (selectedView === "faculty" && !isAdmin()) return;

        navButtons.forEach(item => item.classList.remove("active"));
        button.classList.add("active");

        Object.values(dashboardViews).forEach(view => {
            if (view) view.classList.remove("active");
        });

        dashboardViews[selectedView].classList.add("active");
        setText("pageTitle", dashboardTitles[selectedView]);

        if (selectedView === "faculty") {
            await loadPendingFaculty();
        } else if (selectedView === "analytics") {
            await loadKanbanAnalytics();
        } else if (selectedView === "team") {
            await loadTeamMembers();
        } else if (selectedView === "board") {
            await loadDashboard();
        }

        document.getElementById("sidebar")?.classList.remove("open");
        document.getElementById("mobileMenu")?.setAttribute("aria-expanded", "false");
    });
});

// =====================================================
// MOBILE MENU
// =====================================================

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
// TEAM MANAGEMENT ELEMENTS
// =====================================================

const createTeamPanel = document.getElementById("createTeamPanel");
const createTeamForm = document.getElementById("createTeamForm");
const teamNameInput = document.getElementById("teamName");
const teamFacultySelect = document.getElementById("teamFaculty");
const teamMembersSelect = document.getElementById("teamMembers");
const createTeamMessage = document.getElementById("createTeamMessage");
const createTeamButton = document.getElementById("createTeamButton");
const createdTeamsList = document.getElementById("createdTeamsList");
const refreshTeamsButton = document.getElementById("refreshTeamsButton");

async function fetchAccessibleTeams() {
    if (!currentUser) return [];

    const path = isAdmin() ? "/teams" : "/teams/my";
    const teams = await apiRequest(path);

    if (!Array.isArray(teams)) {
        throw new Error("Unexpected teams response from server.");
    }

    kanbanTeams = teams;
    return teams;
}

// The backend should provide /users/team-options for member team creation.
// That endpoint should return approved faculty and member UserResponse items.
async function loadTeamAssignmentOptions() {
    if (!teamFacultySelect || !teamMembersSelect || !(isAdmin() || isMember())) return;

    teamFacultySelect.replaceChildren();
    teamMembersSelect.replaceChildren();

    const facultyPlaceholder = document.createElement("option");
    facultyPlaceholder.value = "";
    facultyPlaceholder.textContent = "Select approved Faculty";
    teamFacultySelect.appendChild(facultyPlaceholder);

    try {
        const users = await apiRequest(isMember() ? "/users/team-options" : "/users");

        if (!Array.isArray(users)) {
            throw new Error("Expected an array of users from the server.");
        }

        workspaceUsers = users;

        const faculty = users.filter(user =>
            user.role === "FACULTY" && user.approved === true
        );

        const members = users.filter(user =>
            user.role === "MEMBER" && user.approved !== false
        );

        faculty.forEach(user => {
            const option = document.createElement("option");
            option.value = String(user.id);
            option.textContent = `${user.name} (${user.email})`;
            teamFacultySelect.appendChild(option);
        });

        if (!faculty.length) {
            facultyPlaceholder.textContent = "No approved Faculty accounts available";
        }

        members.forEach(user => {
            const option = document.createElement("option");
            option.value = String(user.id);
            option.textContent = `${user.name} (${user.email})`;

            // Include the current member in their own team.
            if (isMember() && String(user.id) === String(currentUser.id)) {
                option.selected = true;
            }

            teamMembersSelect.appendChild(option);
        });

        if (!members.length) {
            const option = document.createElement("option");
            option.disabled = true;
            option.textContent = "No approved Members available";
            teamMembersSelect.appendChild(option);
        }
    } catch (error) {
        showMessage(
            createTeamMessage,
            `Could not load team creation options: ${error.message}. Check the backend endpoint.`
        );
    }
}

// =====================================================
// TEAM PROGRESS HELPERS
// =====================================================

function getTeamTasks(team) {
    return kanbanTasks.filter(task =>
        getTaskTeamId(task) != null &&
        String(getTaskTeamId(task)) === String(team.id)
    );
}

function getStatusCounts(tasks) {
    return {
        BACKLOG: tasks.filter(task => task.status === "BACKLOG").length,
        DOING: tasks.filter(task => task.status === "DOING").length,
        REVIEW: tasks.filter(task => task.status === "REVIEW").length,
        DONE: tasks.filter(task => task.status === "DONE").length
    };
}

function getCompletionPercentage(tasks) {
    if (!tasks.length) return 0;
    return Math.round((tasks.filter(task => task.status === "DONE").length / tasks.length) * 100);
}

function getProjectStatus(tasks) {
    if (!tasks.length) return "Not started";
    return tasks.every(task => task.status === "DONE") ? "Completed" : "In progress";
}

function renderTeamProgress(team, card) {
    const tasks = getTeamTasks(team);
    const counts = getStatusCounts(tasks);
    const percentage = getCompletionPercentage(tasks);

    const section = document.createElement("section");
    section.className = "team-progress-section";

    addText(section, "h4", "Project progress");

    const summary = document.createElement("div");
    summary.className = "task-card-details";
    addText(summary, "span", `Total tasks: ${tasks.length}`);
    addText(summary, "span", `Completed: ${counts.DONE}`);
    addText(summary, "span", `Progress: ${percentage}%`);
    section.appendChild(summary);

    const track = document.createElement("div");
    track.className = "progress-track";
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-label", `${team.name} completion`);
    track.setAttribute("aria-valuenow", String(percentage));
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");

    const fill = document.createElement("div");
    fill.className = "progress-fill";
    fill.style.width = `${percentage}%`;
    track.appendChild(fill);
    section.appendChild(track);

    addText(section, "p", `Project status: ${getProjectStatus(tasks)}`, "team-project-status");

    const statusGrid = document.createElement("div");
    statusGrid.className = "task-card-details team-status-counts";
    addText(statusGrid, "span", `Backlog: ${counts.BACKLOG}`);
    addText(statusGrid, "span", `Doing: ${counts.DOING}`);
    addText(statusGrid, "span", `Review: ${counts.REVIEW}`);
    addText(statusGrid, "span", `Done: ${counts.DONE}`);
    section.appendChild(statusGrid);

    card.appendChild(section);

    addText(card, "h4", "Member work summary");

    const memberIds = Array.isArray(team.memberIds) ? team.memberIds : [];
    const memberNames = Array.isArray(team.memberNames) ? team.memberNames : [];
    const memberList = document.createElement("div");
    memberList.className = "team-member-progress-list";

    if (!memberNames.length) {
        addText(memberList, "p", "No members assigned to this team.", "muted");
    } else {
        memberNames.forEach((memberName, index) => {
            const memberId = memberIds[index];
            const memberTasks = tasks.filter(task => {
                const assigneeId = getTaskAssigneeId(task);

                // Use ID when available; names are only a fallback.
                return memberId != null
                    ? String(assigneeId) === String(memberId)
                    : getTaskAssigneeName(task) === memberName;
            });

            const memberCounts = getStatusCounts(memberTasks);
            const memberCard = document.createElement("div");
            memberCard.className = "team-member-progress";

            addText(memberCard, "strong", memberName);
            addText(memberCard, "p", `Assigned tasks: ${memberTasks.length}`);
            addText(
                memberCard,
                "p",
                `Backlog ${memberCounts.BACKLOG} · Doing ${memberCounts.DOING} · Review ${memberCounts.REVIEW} · Done ${memberCounts.DONE}`
            );
            addText(
                memberCard,
                "p",
                memberTasks.length
                    ? `Completion: ${getCompletionPercentage(memberTasks)}%`
                    : "No tasks assigned yet.",
                "muted"
            );

            memberList.appendChild(memberCard);
        });
    }

    card.appendChild(memberList);

    addText(card, "h4", "Team tasks");

    if (!tasks.length) {
        addText(card, "p", "No tasks have been assigned to this team yet.", "muted");
        return;
    }

    const taskList = document.createElement("div");
    taskList.className = "team-task-list";

    tasks.forEach(task => {
        const row = document.createElement("div");
        row.className = "team-task-row";

        addText(row, "strong", task.title);
        addText(row, "span", formatStatus(task.status), "team-task-status");
        addText(row, "p", `Assigned to: ${getTaskAssigneeName(task) || "Unassigned"}`);
        if (task.dueDate) addText(row, "p", `Due: ${task.dueDate}`);

        taskList.appendChild(row);
    });

    card.appendChild(taskList);
}

function renderCreatedTeams(teams) {
    if (!createdTeamsList) return;
    createdTeamsList.replaceChildren();

    if (!Array.isArray(teams) || !teams.length) {
        addText(
            createdTeamsList,
            "p",
            "No teams have been created or assigned to you yet.",
            "muted"
        );
        return;
    }

    teams.forEach(team => {
        const card = document.createElement("article");
        card.className = "task-card team-card";

        addText(card, "h3", team.name, "task-card-title");
        addText(card, "p", `Team ID: ${team.id}`, "muted");

        addText(card, "h4", "Assigned Faculty");
        addText(card, "p", team.facultyName || "Faculty not assigned");

        addText(card, "h4", "Team Members");
        const members = Array.isArray(team.memberNames) ? team.memberNames : [];
        const list = document.createElement("ul");

        if (!members.length) {
            addText(list, "li", "No members assigned.");
        } else {
            members.forEach(name => addText(list, "li", name));
        }

        card.appendChild(list);
        renderTeamProgress(team, card);
        createdTeamsList.appendChild(card);
    });
}

async function loadCreatedTeams() {
    if (!currentUser) return;

    if (createdTeamsList) {
        createdTeamsList.replaceChildren();
        addText(createdTeamsList, "p", "Loading teams...", "muted");
    }

    try {
        const teams = await fetchAccessibleTeams();
        renderCreatedTeams(teams);
    } catch (error) {
        console.error("Could not load teams:", error);
        if (createdTeamsList) {
            createdTeamsList.replaceChildren();
            addText(createdTeamsList, "p", `Could not load teams: ${error.message}`);
        }
    }
}

// =====================================================
// CREATE TEAM
// =====================================================

if (createTeamForm) {
    createTeamForm.addEventListener("submit", async event => {
        event.preventDefault();

        if (!(isAdmin() || isMember())) {
            showMessage(createTeamMessage, "Your role is not allowed to create teams.");
            return;
        }

        const name = teamNameInput?.value.trim() || "";
        const facultyId = teamFacultySelect?.value || "";
        const selectedMemberIds = teamMembersSelect
            ? Array.from(teamMembersSelect.selectedOptions)
                .filter(option => option.value)
                .map(option => Number(option.value))
            : [];

        // Ensure the member creating the team is included.
        if (isMember() && currentUser?.id != null) {
            if (!selectedMemberIds.includes(Number(currentUser.id))) {
                selectedMemberIds.push(Number(currentUser.id));
            }
        }

        if (name.length < 3) {
            showMessage(createTeamMessage, "Team name must contain at least 3 characters.");
            return;
        }

        if (!facultyId) {
            showMessage(createTeamMessage, "Please select an approved Faculty member.");
            return;
        }

        if (!selectedMemberIds.length) {
            showMessage(createTeamMessage, "Please select at least one team member.");
            return;
        }

        if (createTeamButton) {
            createTeamButton.disabled = true;
            createTeamButton.textContent = "Creating team...";
        }

        try {
            const createdTeam = await apiRequest("/teams", {
                method: "POST",
                body: JSON.stringify({
                    name,
                    facultyId: Number(facultyId),
                    memberIds: [...new Set(selectedMemberIds)]
                })
            });

            showMessage(createTeamMessage, `Team "${createdTeam.name}" created successfully.`, true);
            createTeamForm.reset();

            await loadTeamAssignmentOptions();
            await loadDashboard();
            await loadCreatedTeams();

            window.alert(`Team "${createdTeam.name}" was created successfully.`);
        } catch (error) {
            showMessage(
                createTeamMessage,
                `Could not create team: ${error.message}. If you are a Member, confirm TeamController allows member team creation.`
            );
        } finally {
            if (createTeamButton) {
                createTeamButton.disabled = false;
                createTeamButton.textContent = "Create Team";
            }
        }
    });
}

if (refreshTeamsButton) {
    refreshTeamsButton.addEventListener("click", async () => {
        await loadCreatedTeams();
        await loadTeamAssignmentOptions();
    });
}

// =====================================================
// WORKSPACE USERS AND TEAM MANAGEMENT
// =====================================================

async function loadTeamMembers() {
    const table = document.getElementById("teamTable");
    const view = document.getElementById("teamView");

    if (createTeamPanel) {
        createTeamPanel.hidden = !(isAdmin() || isMember());
    }

    if (table) table.replaceChildren();

    // Members may not have permission to see all workspace users.
    // Use the current user's details for their dashboard instead.
    try {
        if (isAdmin() || isFaculty()) {
            const users = await apiRequest("/users");
            workspaceUsers = Array.isArray(users) ? users : [];

            if (table) {
                workspaceUsers.forEach(user => {
                    const row = document.createElement("tr");
                    addText(row, "td", user.name);
                    addText(row, "td", user.email);
                    addText(row, "td", user.role);
                    table.appendChild(row);
                });
            }
        } else if (table) {
            const row = document.createElement("tr");
            addText(row, "td", currentUser?.name || "Current user");
            addText(row, "td", currentUser?.email || "");
            addText(row, "td", currentUser?.role || "MEMBER");
            table.appendChild(row);
        }

        if (view) view.dataset.loaded = "true";
    } catch (error) {
        if (table) {
            const row = document.createElement("tr");
            const cell = addText(row, "td", `Could not load workspace users: ${error.message}`);
            cell.colSpan = 3;
            table.appendChild(row);
        }
    }

    await loadTeamAssignmentOptions();
    await loadCreatedTeams();
}

if (refreshTeamsButton) {
    refreshTeamsButton.addEventListener("click", loadTeamMembers);
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
            console.warn("Logout request failed:", error.message);
        } finally {
            window.location.href = "index.html";
        }
    });
}

// =====================================================
// TASK DIALOG AND TEAM SELECTOR
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

function createTaskTeamSelect() {
    let select = document.getElementById("taskTeam");
    if (select || !taskForm) return select;

    const field = document.createElement("div");
    field.className = "form-group task-team-field";

    const label = document.createElement("label");
    label.htmlFor = "taskTeam";
    label.textContent = "Team / Project";

    select = document.createElement("select");
    select.id = "taskTeam";
    select.name = "teamId";
    select.required = true;

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a team";
    select.appendChild(placeholder);

    field.appendChild(label);
    field.appendChild(select);

    if (taskAssignee) {
        let directChild = taskAssignee;
        while (directChild.parentElement && directChild.parentElement !== taskForm) {
            directChild = directChild.parentElement;
        }

        if (directChild.parentElement === taskForm) {
            taskForm.insertBefore(field, directChild);
        } else {
            taskForm.appendChild(field);
        }
    } else {
        taskForm.appendChild(field);
    }

    return select;
}

const taskTeamSelect = createTaskTeamSelect();

async function loadTaskTeams(selectedTeamId = "") {
    if (!taskTeamSelect || !currentUser) return;

    taskTeamSelect.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a team";
    taskTeamSelect.appendChild(placeholder);

    try {
        const teams = await fetchAccessibleTeams();

        teams.forEach(team => {
            const option = document.createElement("option");
            option.value = String(team.id);
            option.textContent = team.name;
            taskTeamSelect.appendChild(option);
        });

        if (!teams.length) {
            placeholder.textContent = "No teams available — create or join a team first";
        }

        if (selectedTeamId != null && String(selectedTeamId) !== "") {
            taskTeamSelect.value = String(selectedTeamId);
        }

        if (selectedTeamId && taskTeamSelect.value !== String(selectedTeamId)) {
            taskTeamSelect.value = "";
        }
    } catch (error) {
        console.error("Could not load task teams:", error);
        showTaskError("Could not load teams: " + error.message);
    }
}

async function loadTaskAssignees(selectedTeamId = "", selectedAssigneeId = "") {
    if (!taskAssignee) return;

    taskAssignee.replaceChildren();

    const unassigned = document.createElement("option");
    unassigned.value = "";
    unassigned.textContent = "Unassigned";
    taskAssignee.appendChild(unassigned);

    try {
        let users = [];

        if (isMember()) {
            // Members should only assign tasks to people in their own teams.
            users = workspaceUsers.length
                ? workspaceUsers
                : await apiRequest("/users/team-options");
        } else {
            users = await apiRequest("/users");
        }

        const selectedTeam = kanbanTeams.find(
            team => String(team.id) === String(selectedTeamId)
        );

        let members = users.filter(user =>
            user.role === "MEMBER" && user.approved !== false
        );

        if (selectedTeam && Array.isArray(selectedTeam.memberIds)) {
            members = members.filter(user =>
                selectedTeam.memberIds.some(id => String(id) === String(user.id))
            );
        } else if (selectedTeam && Array.isArray(selectedTeam.memberNames)) {
            members = members.filter(user =>
                selectedTeam.memberNames.includes(user.name)
            );
        }

        members.forEach(user => {
            const option = document.createElement("option");
            option.value = String(user.id);
            option.textContent = user.name;
            taskAssignee.appendChild(option);
        });

        if (selectedAssigneeId != null && selectedAssigneeId !== "") {
            taskAssignee.value = String(selectedAssigneeId);

            if (taskAssignee.value !== String(selectedAssigneeId)) {
                const option = document.createElement("option");
                option.value = String(selectedAssigneeId);
                option.textContent = "Current assignee";
                taskAssignee.appendChild(option);
                taskAssignee.value = String(selectedAssigneeId);
            }
        }
    } catch (error) {
        console.error("Could not load task assignees:", error);
        showTaskError("Could not load team members: " + error.message);
    }
}

if (taskTeamSelect) {
    taskTeamSelect.addEventListener("change", async () => {
        await loadTaskAssignees(taskTeamSelect.value);
    });
}

if (newTaskButton && taskDialog) {
    newTaskButton.addEventListener("click", async () => {
        resetTaskForm();
        taskFormError?.classList.add("hidden");
        taskFormError?.classList.remove("error", "success");

        taskDialog.showModal();
        await loadTaskTeams();
        await loadTaskAssignees(taskTeamSelect?.value || "");
    });
}

if (closeTaskDialog && taskDialog) {
    closeTaskDialog.addEventListener("click", () => taskDialog.close());
}

if (cancelTaskButton && taskDialog) {
    cancelTaskButton.addEventListener("click", () => taskDialog.close());
}

function resetTaskForm() {
    taskForm?.reset();
    setText("taskDialogTitle", "Create a task");

    if (saveTaskButton) saveTaskButton.textContent = "Save task";

    const taskId = document.getElementById("taskId");
    if (taskId) taskId.value = "";

    if (taskDueDate) {
        taskDueDate.disabled = false;
        taskDueDate.readOnly = false;
    }

    if (taskTeamSelect) taskTeamSelect.value = "";
}

async function editTask(task) {
    if (!taskDialog || !taskForm) return;

    taskFormError?.classList.add("hidden");
    taskFormError?.classList.remove("error", "success");

    try {
        await loadTaskTeams(getTaskTeamId(task) ?? "");

        await loadTaskAssignees(
            getTaskTeamId(task) ?? "",
            getTaskAssigneeId(task) ?? ""
        );

        const taskIdInput = document.getElementById("taskId");
        const titleInput = document.getElementById("taskTitle");
        const descriptionInput = document.getElementById("taskDescription");
        const priorityInput = document.getElementById("taskPriority");
        const statusInput = document.getElementById("taskStatus");

        if (taskIdInput) taskIdInput.value = task.id;
        if (titleInput) titleInput.value = task.title || "";
        if (descriptionInput) descriptionInput.value = task.description || "";
        if (priorityInput) priorityInput.value = task.priority || "MEDIUM";
        if (statusInput) statusInput.value = task.status || "BACKLOG";

        if (taskDueDate) {
            taskDueDate.value = task.dueDate || "";
            taskDueDate.disabled = false;
            taskDueDate.readOnly = false;
        }

        if (taskTeamSelect) {
            taskTeamSelect.value = getTaskTeamId(task) != null
                ? String(getTaskTeamId(task))
                : "";
        }

        setText("taskDialogTitle", "Edit task");
        if (saveTaskButton) saveTaskButton.textContent = "Save changes";

        taskDialog.showModal();
    } catch (error) {
        showTaskError("Could not open task for editing: " + error.message);
    }
}

function showTaskError(message) {
    if (!taskFormError) {
        window.alert(message);
        return;
    }

    taskFormError.textContent = message;
    taskFormError.classList.remove("hidden");
}

// =====================================================
// SAVE TASK
// =====================================================

if (taskForm) {
    taskForm.addEventListener("submit", async event => {
        event.preventDefault();
        taskFormError?.classList.add("hidden");

        const title = document.getElementById("taskTitle")?.value.trim() || "";
        const description = document.getElementById("taskDescription")?.value.trim() || "";
        const priority = document.getElementById("taskPriority")?.value || "MEDIUM";
        const dueDate = document.getElementById("taskDueDate")?.value || "";
        const assigneeValue = document.getElementById("taskAssignee")?.value || "";
        const status = document.getElementById("taskStatus")?.value || "BACKLOG";
        const taskId = document.getElementById("taskId")?.value || "";
        const teamId = taskTeamSelect?.value || "";

        if (!title) {
            showTaskError("Please enter a task title.");
            return;
        }

        if (!teamId) {
            showTaskError("Please select the team this task belongs to.");
            return;
        }

        const taskData = {
            title,
            description,
            priority,
            status,
            dueDate: dueDate || null,
            assigneeId: assigneeValue ? Number(assigneeValue) : null,
            teamId: Number(teamId)
        };

        if (saveTaskButton) {
            saveTaskButton.disabled = true;
            saveTaskButton.textContent = taskId ? "Saving changes..." : "Saving...";
        }

        try {
            const path = taskId ? `/tasks/${encodeURIComponent(taskId)}` : "/tasks";

            await apiRequest(path, {
                method: taskId ? "PUT" : "POST",
                body: JSON.stringify(taskData)
            });

            taskDialog.close();
            resetTaskForm();
            await loadDashboard();
        } catch (error) {
            showTaskError(`Could not save the task: ${error.message}`);
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
            throw new Error("Unexpected tasks response from server.");
        }

        kanbanTasks = tasks;
        renderKanbanBoard();
        renderStatusChart();

        await loadCreatedTeams();
        await loadKanbanAnalytics();
    } catch (error) {
        console.error("Could not load tasks:", error);
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
        board.parentElement.insertBefore(box, board);
    }

    box.textContent = message;
}

function renderKanbanBoard() {
    Object.values(columns).forEach(id => {
        document.getElementById(id)?.replaceChildren();
    });

    const totals = { BACKLOG: 0, DOING: 0, REVIEW: 0, DONE: 0 };

    kanbanTasks.forEach(task => {
        const list = document.getElementById(columns[task.status]);
        if (!list) return;

        if (Object.hasOwn(totals, task.status)) totals[task.status]++;
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

// =====================================================
// TASK CARDS AND STATUS ACTIONS
// =====================================================

function renderTaskCard(task, list) {
    const card = document.createElement("article");
    card.className = "task-card";

    addText(card, "h4", task.title, "task-card-title");

    if (task.description) {
        addText(card, "p", task.description, "task-card-description");
    }

    const details = document.createElement("div");
    details.className = "task-card-details";

    addText(details, "span", `Priority: ${task.priority || "MEDIUM"}`);
    addText(details, "span", task.teamName ? `Team: ${task.teamName}` : "Team not assigned");
    addText(
        details,
        "span",
        getTaskAssigneeName(task) ? `Assigned: ${getTaskAssigneeName(task)}` : "Unassigned"
    );

    if (task.dueDate) addText(details, "span", `Due: ${task.dueDate}`);
    card.appendChild(details);

    const actions = document.createElement("div");
    actions.className = "task-card-actions";

    addActionButton(actions, "Edit", () => editTask(task));

    if (task.status === "BACKLOG") {
        addActionButton(actions, "Start task", () => changeTaskStatus(task.id, "DOING"));
    }

    if (task.status === "DOING") {
        addActionButton(actions, "Submit for review", () => changeTaskStatus(task.id, "REVIEW"));
    }

    if (task.status === "REVIEW") {
        if (isFaculty()) {
            addActionButton(actions, "Review task", () => openReviewDialog(task), "btn btn-primary");
        }

        addActionButton(actions, "Return to Doing", () => changeTaskStatus(task.id, "DOING"));
    }

    card.appendChild(actions);
    list.appendChild(card);
}

async function changeTaskStatus(taskId, status) {
    try {
        await apiRequest(`/tasks/${encodeURIComponent(taskId)}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status })
        });

        await loadDashboard();
    } catch (error) {
        window.alert("Could not change the task status: " + error.message);
    }
}

// =====================================================
// FACULTY TASK REVIEW
// =====================================================

const reviewDialog = document.getElementById("reviewDialog");
const reviewForm = document.getElementById("reviewForm");
const closeReviewDialog = document.getElementById("closeReviewDialog");
const requestChangesButton = document.getElementById("requestChangesButton");

function openReviewDialog(task) {
    if (!isFaculty()) {
        window.alert("Only Faculty can review and approve tasks.");
        return;
    }

    if (!reviewDialog) {
        window.alert("Review dialog was not found.");
        return;
    }

    const taskIdInput = document.getElementById("reviewTaskId");
    const commentInput = document.getElementById("reviewComment");

    if (taskIdInput) taskIdInput.value = task.id;
    if (commentInput) commentInput.value = "";

    setText("reviewTaskTitle", task.title);
    reviewDialog.showModal();
}

if (closeReviewDialog && reviewDialog) {
    closeReviewDialog.addEventListener("click", () => reviewDialog.close());
}

async function submitTaskReview(decision) {
    if (!isFaculty()) {
        window.alert("Only Faculty can review and approve tasks.");
        return;
    }

    const taskId = document.getElementById("reviewTaskId")?.value || "";
    const comment = document.getElementById("reviewComment")?.value.trim() || "";

    if (!taskId) {
        window.alert("Task ID is missing.");
        return;
    }

    try {
        await apiRequest(`/tasks/${encodeURIComponent(taskId)}/review`, {
            method: "POST",
            body: JSON.stringify({ decision, comment })
        });

        reviewDialog?.close();
        await loadDashboard();

        window.alert(
            decision === "APPROVE"
                ? "Task approved and moved to Done."
                : "Changes requested. Task moved back to Doing."
        );
    } catch (error) {
        window.alert("Review failed: " + error.message);
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
        setText("completionRate", `${data.completionRate ?? 0}%`);

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
            wipBar.style.width = `${total ? Math.min(100, wip / total * 100) : 0}%`;
        }

        if (reviewBar) {
            reviewBar.style.width = `${total ? Math.min(100, review / total * 100) : 0}%`;
        }

        renderStatusChart();
    } catch (error) {
        console.warn("Analytics could not be loaded:", error.message);
    }
}

function renderStatusChart() {
    const chart = document.getElementById("statusChart");
    if (!chart) return;

    chart.replaceChildren();

    const counts = { BACKLOG: 0, DOING: 0, REVIEW: 0, DONE: 0 };

    kanbanTasks.forEach(task => {
        if (Object.hasOwn(counts, task.status)) counts[task.status]++;
    });

    const maximum = Math.max(1, ...Object.values(counts));

    Object.entries(counts).forEach(([status, count]) => {
        const row = document.createElement("div");
        row.className = "chart-row";

        addText(row, "span", formatStatus(status));

        const track = document.createElement("div");
        track.className = "progress-track";

        const fill = document.createElement("div");
        fill.className = "progress-fill";
        fill.style.width = `${count / maximum * 100}%`;

        track.appendChild(fill);
        row.appendChild(track);
        addText(row, "strong", count);
        chart.appendChild(row);
    });
}

// =====================================================
// REFRESH BUTTONS
// =====================================================

const refreshButton = document.getElementById("refreshButton");
if (refreshButton) refreshButton.addEventListener("click", loadDashboard);

const analyticsRefresh = document.getElementById("analyticsRefresh");
if (analyticsRefresh) {
    analyticsRefresh.addEventListener("click", loadDashboard);
}

// =====================================================
// INITIALIZE DASHBOARD
// =====================================================

if (boardPage) {
    (async () => {
        const userLoaded = await loadCurrentUser();

        if (!userLoaded) return;

        await loadDashboard();

        if (isAdmin() || isMember()) {
            await loadTeamAssignmentOptions();
        }
    })();
}
