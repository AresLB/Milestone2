// API Base URL
const API_BASE = '/api';
let editingSubmissionId = null;

// Database mode for Student 2 (workshops)
let workshopDbMode = 'sql'; // 'sql' or 'nosql'
let analyticsS2DbMode = 'sql'; // 'sql' or 'nosql'

// DOM Elements
const navButtons = document.querySelectorAll('.nav-btn');
const sections = document.querySelectorAll('.section');

// Navigation
navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const sectionId = btn.dataset.section;
        
        // Update active nav button
        navButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Show corresponding section
        sections.forEach(s => s.classList.remove('active'));
        document.getElementById(sectionId).classList.add('active');
        
        // Load section data
        loadSectionData(sectionId);
    });
});

// Toast Notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// API Helper
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
            },
            ...options
        });
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}: Request failed`);
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        // Re-throw with more context
        if (error.message.includes('Failed to fetch')) {
            throw new Error('Cannot connect to server. Make sure Docker containers are running.');
        }
        throw error;
    }
}

// Load section-specific data
function loadSectionData(sectionId) {
    switch (sectionId) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'submit-project':
            loadEventsForSubmission();
            loadSubmissions();
            break;
        case 'manage-workshops':
            loadEventsForWorkshops();
            loadWorkshops();
            break;
        case 'analytics-s1':
            loadSubmissionAnalytics();
            break;
        case 'analytics-s2':
            loadWorkshopAnalytics();
            break;
        case 'data-management':
            loadDbStats();
            break;
    }
}

// ==================== DASHBOARD ====================

async function loadDashboard() {
    try {
        // Load summary stats
        const summary = await apiCall('/analytics/summary');
        
        document.getElementById('stat-events').textContent = summary.stats.totalEvents;
        document.getElementById('stat-participants').textContent = summary.stats.totalParticipants;
        document.getElementById('stat-submissions').textContent = summary.stats.totalSubmissions;
        document.getElementById('stat-registrations').textContent = summary.stats.totalRegistrations;
        
        // Recent submissions
        const recentHtml = summary.recentSubmissions.length > 0 
            ? `<div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Event Name</th>
                            <th>Project Name</th>
                            <th>Type</th>
                            <th>Participants</th>
                            <th>Description</th>
                            <th>Technology Stack</th>
                            <th>GitHub Repo</th>
                            <th>Submitted</th>                   
                        </tr>
                    </thead>
                    <tbody>
                        ${summary.recentSubmissions.map(s => `
                            <tr>
                                <td>${s.event_name || 'Unassigned'}</td>
                                <td>${s.project_name}</td>
                                <td><span class="badge ${s.submission_type === 'team' ? 'badge-info' : 'badge-success'}">${s.submission_type || 'Unassigned'}</span></td>
                                <td>${s.team || 'Unassigned'}</td>
                                <td>${s.description || 'Unassigned'}</td>
                                <td>${s.technology_stack || 'Unassigned'}</td>
                                <td>${s.repository_url ? `<a href="${s.repository_url}" target="_blank" rel="noopener noreferrer">Repo</a>` : 'Unassigned'}</td>
                                <td>${new Date(s.submission_time).toLocaleString()}</td>                              
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
               </div>`
            : '<p class="empty-state">No submissions yet</p>';
        
        document.getElementById('recent-submissions').innerHTML = recentHtml;
        
        // Health check
        const health = await apiCall('/health');
        document.getElementById('health-status').innerHTML = `
            <p><span class="badge badge-success">MySQL: ${health.mysql}</span></p>
            <p><span class="badge badge-success">MongoDB: ${health.mongodb}</span></p>
        `;
        
    } catch (error) {
        showToast('Failed to load dashboard data', 'error');
        document.getElementById('health-status').innerHTML = `
            <p><span class="badge badge-error">Error: ${error.message}</span></p>
        `;
    }
}

// ==================== SUBMIT PROJECT (Student 1) - ENHANCED ====================

// Load available events for submission
async function loadEventsForSubmission() {
    try {
        const data = await apiCall('/submissions/events/available');
        
        const selectHtml = data.data.map(e => 
            `<option value="${e.event_id}">${e.name} (${e.event_type}) - ${new Date(e.start_date).toLocaleDateString()} [${e.registration_count} registered, ${e.submission_count} submissions]</option>`
        ).join('');
        
        const eventSelect = document.getElementById('event-select-submission');
        if (eventSelect) {
            eventSelect.innerHTML = '<option value="">-- Select an Event --</option>' + selectHtml;
        }
        
        // Clear team members list when no event is selected
        document.getElementById('team-members-list').innerHTML = '<p class="hint">Please select an event first to see registered participants.</p>';
        
    } catch (error) {
        console.error('Failed to load events:', error);
        showToast('Failed to load events for submission', 'error');
    }
}

// Load participants for selected event (Enhanced with event filtering)
async function loadParticipantsForProject(eventId) {
    try {
        if (!eventId) {
            document.getElementById('team-members-list').innerHTML = '<p class="hint">Please select an event first to see registered participants.</p>';
            return;
        }
        
        const data = await apiCall(`/submissions/participants/${eventId}`);
        
        if (data.data.length === 0) {
            document.getElementById('team-members-list').innerHTML = '<p class="empty-state">No participants registered for this event yet.</p>';
            return;
        }
        
        const listHtml = data.data.map(p => `
            <div class="checkbox-item">
                <input type="checkbox" id="team-${p.person_id}" value="${p.person_id}">
                <label for="team-${p.person_id}">
                    ${p.first_name} ${p.last_name} (${p.email})
                    <span class="hint" style="display: block; margin-left: 1.75rem; font-size: 0.8rem;">
                        Reg: ${p.registration_number} | Ticket: ${p.ticket_type}
                    </span>
                </label>
            </div>
        `).join('');
        
        document.getElementById('team-members-list').innerHTML = listHtml;
        
    } catch (error) {
        console.error('Failed to load participants:', error);
        document.getElementById('team-members-list').innerHTML = '<p class="empty-state">Failed to load participants. Please try again.</p>';
        showToast('Failed to load participants', 'error');
    }
}

// Event selection change handler for submission form
document.addEventListener('DOMContentLoaded', () => {
    const eventSelect = document.getElementById('event-select-submission');
    if (eventSelect) {
        eventSelect.addEventListener('change', async (e) => {
            const eventId = e.target.value;
            
            // Clear submission type when event changes
            const submissionTypeInputs = document.querySelectorAll('input[name="submission-type"]');
            submissionTypeInputs.forEach(input => input.checked = false);
            
            // Load participants for the selected event
            if (eventId) {
                await loadParticipantsForProject(eventId);
            } else {
                document.getElementById('team-members-list').innerHTML = '<p class="hint">Please select an event first to see registered participants.</p>';
            }
        });
    }
    
    // Submission type change handler
    const submissionTypeInputs = document.querySelectorAll('input[name="submission-type"]');
    submissionTypeInputs.forEach(input => {
        input.addEventListener('change', (e) => {
            const selectedType = e.target.value;
            const teamMembersList = document.getElementById('team-members-list');
            
            if (selectedType === 'individual') {
                teamMembersList.classList.add('individual-mode');
                // Add hint for individual selection
                const existingHint = document.querySelector('.individual-hint');
                if (!existingHint) {
                    const hint = document.createElement('p');
                    hint.className = 'hint individual-hint';
                    hint.style.backgroundColor = '#fefcbf';
                    hint.style.padding = '0.5rem';
                    hint.style.borderRadius = '4px';
                    hint.textContent = 'Individual submission: Select only yourself';
                    teamMembersList.prepend(hint);
                }
            } else {
                teamMembersList.classList.remove('individual-mode');
                const hint = document.querySelector('.individual-hint');
                if (hint) hint.remove();
            }
        });
    });
    
    // Initialize dashboard on load
    loadDashboard();

    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => {
            resetSubmissionForm();
        });
    }
});

async function loadSubmissions() {
    try {
        const data = await apiCall('/submissions');
        
        const tableHtml = data.data.length > 0
            ? `<div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Event</th>
                            <th>Project Name</th>
                            <th>Type</th>
                            <th>Team Members</th>
                            <th>Technology Stack</th>
                            <th>Submitted</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.data.map((s, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${s.event_name || 'N/A'}</td>
                                <td>${s.project_name}</td>
                                <td><span class="badge ${s.submission_type === 'team' ? 'badge-info' : 'badge-success'}">${s.submission_type || 'N/A'}</span></td>
                                <td>${s.team_members || 'Unassigned'}</td>
                                <td>${s.technology_stack || 'N/A'}</td>
                                <td>${new Date(s.submission_time).toLocaleString()}</td>
                                <td>
                                    <button class="btn btn-secondary btn-sm" onclick="startEditSubmission(${s.submission_id})">Edit</button>
                                    <button class="btn btn-danger btn-sm" onclick="deleteSubmission(${s.submission_id})">Delete</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
               </div>`
            : '<p class="empty-state">No submissions yet. Submit your first project!</p>';
        
        document.getElementById('submissions-list').innerHTML = tableHtml;
        
    } catch (error) {
        document.getElementById('submissions-list').innerHTML = '<p>Failed to load submissions</p>';
    }
}

function setSubmissionFormMode(isEditing) {
    const submitBtn = document.getElementById('submit-project-btn');
    const cancelBtn = document.getElementById('cancel-edit-btn');
    if (submitBtn) {
        submitBtn.textContent = isEditing ? 'Update Project' : 'Submit Project';
    }
    if (cancelBtn) {
        cancelBtn.style.display = isEditing ? 'inline-flex' : 'none';
    }
}

function resetSubmissionForm() {
    const form = document.getElementById('submit-project-form');
    if (form) form.reset();

    document.querySelectorAll('#team-members-list input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });

    const teamMembersList = document.getElementById('team-members-list');
    if (teamMembersList) {
        teamMembersList.classList.remove('individual-mode');
        const hint = document.querySelector('.individual-hint');
        if (hint) hint.remove();
        teamMembersList.innerHTML = '<p class="hint">Please select an event first to see registered participants.</p>';
    }

    editingSubmissionId = null;
    setSubmissionFormMode(false);
    loadEventsForSubmission();
}

async function startEditSubmission(id) {
    try {
        const result = await apiCall(`/submissions/${id}`);
        const submission = result.data;
        if (!submission) {
            showToast('Submission not found', 'error');
            return;
        }

        editingSubmissionId = id;
        setSubmissionFormMode(true);

        await loadEventsForSubmission();
        const eventSelect = document.getElementById('event-select-submission');
        if (eventSelect) {
            eventSelect.value = submission.event_id;
        }

        await loadParticipantsForProject(submission.event_id);

        const teamMemberIds = submission.team_member_ids
            ? submission.team_member_ids.split(',').map(idStr => parseInt(idStr, 10))
            : [];

        document.querySelectorAll('#team-members-list input[type="checkbox"]').forEach(cb => {
            cb.checked = teamMemberIds.includes(parseInt(cb.value, 10));
        });

        const typeInput = document.querySelector(`input[name="submission-type"][value="${submission.submission_type}"]`);
        if (typeInput) {
            typeInput.checked = true;
            typeInput.dispatchEvent(new Event('change'));
        }

        document.getElementById('project-name').value = submission.project_name || '';
        document.getElementById('project-description').value = submission.description || '';
        document.getElementById('tech-stack').value = submission.technology_stack || '';
        document.getElementById('repo-url').value = submission.repository_url || '';

        document.getElementById('submit-project').scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        showToast(`Failed to load submission: ${error.message}`, 'error');
    }
}

// Submit Project Form Handler - ENHANCED
document.getElementById('submit-project-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get event selection
    const eventId = parseInt(document.getElementById('event-select-submission').value);
    if (!eventId) {
        showToast('Please select an event', 'error');
        return;
    }
    
    // Get submission type
    const submissionTypeInput = document.querySelector('input[name="submission-type"]:checked');
    if (!submissionTypeInput) {
        showToast('Please select submission type (Individual or Team)', 'error');
        return;
    }
    const submissionType = submissionTypeInput.value;
    
    // Get selected team members
    const teamCheckboxes = document.querySelectorAll('#team-members-list input[type="checkbox"]:checked');
    const teamMemberIds = Array.from(teamCheckboxes).map(cb => parseInt(cb.value));
    
    if (teamMemberIds.length === 0) {
        showToast('Please select at least one team member', 'error');
        return;
    }
    
    // Validate submission type consistency
    if (submissionType === 'individual' && teamMemberIds.length !== 1) {
        showToast('Individual submissions must have exactly one team member', 'error');
        return;
    }
    
    if (submissionType === 'team' && teamMemberIds.length < 2) {
        showToast('Team submissions must have at least two members', 'error');
        return;
    }
    
    const projectData = {
        event_id: eventId,
        project_name: document.getElementById('project-name').value,
        description: document.getElementById('project-description').value,
        technology_stack: document.getElementById('tech-stack').value,
        repository_url: document.getElementById('repo-url').value,
        team_member_ids: teamMemberIds,
        submission_type: submissionType
    };
    
    try {
        const endpoint = editingSubmissionId ? `/submissions/${editingSubmissionId}` : '/submissions';
        const method = editingSubmissionId ? 'PUT' : 'POST';
        const result = await apiCall(endpoint, {
            method,
            body: JSON.stringify(projectData)
        });
        
        showToast(result.message || (editingSubmissionId ? 'Project updated successfully!' : 'Project submitted successfully!'), 'success');
        resetSubmissionForm();
        
        // Reload data
        loadSubmissions();
        loadDashboard();
        
    } catch (error) {
        showToast(`Failed to ${editingSubmissionId ? 'update' : 'submit'} project: ${error.message}`, 'error');
    }
});

async function deleteSubmission(id) {
    if (!confirm('Are you sure you want to delete this submission?')) return;
    
    try {
        await apiCall(`/submissions/${id}`, { method: 'DELETE' });
        showToast('Submission deleted', 'success');
        loadSubmissions();
    } catch (error) {
        showToast(`Failed to delete: ${error.message}`, 'error');
    }
}

// ==================== MANAGE WORKSHOPS (Student 2) ====================

let editingWorkshop = null; // Stores {event_id, workshop_number} when editing

// Toggle database mode for workshops
function setWorkshopDbMode(mode) {
    workshopDbMode = mode;

    // Update toggle button states
    const toggleBtns = document.querySelectorAll('#manage-workshops .toggle-btn');
    toggleBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.db === mode);
    });

    // Update hint text
    const hint = document.getElementById('workshop-db-hint');
    if (hint) {
        const dbName = mode === 'sql' ? 'SQL (MariaDB)' : 'NoSQL (MongoDB)';
        hint.innerHTML = `Currently using: <strong>${dbName}</strong>`;
    }

    // Reset form and reload data
    resetWorkshopForm();
    loadEventsForWorkshops();
    loadWorkshops();
}

async function loadEventsForWorkshops() {
    try {
        // Use different endpoint based on database mode
        const endpoint = workshopDbMode === 'sql' ? '/workshops/events' : '/nosql/workshops/events';
        const data = await apiCall(endpoint);

        const selectHtml = data.data.map(e =>
            `<option value="${e.event_id}">${e.name} - ${new Date(e.start_date).toLocaleDateString()} [${e.workshop_count} workshops]</option>`
        ).join('');

        document.getElementById('workshop-event-select').innerHTML =
            '<option value="">-- Select an Event --</option>' + selectHtml;

    } catch (error) {
        console.error('Failed to load events:', error);
        showToast('Failed to load events', 'error');
    }
}

async function loadWorkshops() {
    try {
        const endpoint = workshopDbMode === 'sql' ? '/workshops' : '/nosql/workshops';
        const data = await apiCall(endpoint);

        const tableHtml = data.data.length > 0
            ? `<div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Workshop #</th>
                            <th>Event</th>
                            <th>Title</th>
                            <th>Duration</th>
                            <th>Skill Level</th>
                            <th>Max Attendees</th>
                            <th>Venue</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.data.map(w => `
                            <tr>
                                <td>${w.workshop_number}</td>
                                <td>${w.event_name}</td>
                                <td>${w.title}</td>
                                <td>${w.duration} min</td>
                                <td><span class="badge ${w.skill_level === 'Beginner' ? 'badge-success' : w.skill_level === 'Intermediate' ? 'badge-warning' : 'badge-info'}">${w.skill_level}</span></td>
                                <td>${w.max_attendees}</td>
                                <td>${w.venue_name || 'N/A'}</td>
                                <td>
                                    <button class="btn btn-secondary btn-sm" onclick="startEditWorkshop(${w.event_id}, ${w.workshop_number})">Edit</button>
                                    <button class="btn btn-danger btn-sm" onclick="deleteWorkshop(${w.event_id}, ${w.workshop_number})">Delete</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
               </div>`
            : '<p class="empty-state">No workshops yet. Create your first workshop!</p>';

        document.getElementById('workshops-list').innerHTML = tableHtml;

    } catch (error) {
        document.getElementById('workshops-list').innerHTML = '<p>Failed to load workshops</p>';
    }
}

function resetWorkshopForm() {
    const form = document.getElementById('workshop-form');
    if (form) form.reset();

    editingWorkshop = null;
    document.getElementById('workshop-submit-btn').textContent = 'Create Workshop';
    document.getElementById('workshop-cancel-btn').style.display = 'none';
    document.getElementById('workshop-event-select').disabled = false;
}

async function startEditWorkshop(eventId, workshopNumber) {
    try {
        const endpoint = workshopDbMode === 'sql'
            ? `/workshops/${eventId}/${workshopNumber}`
            : `/nosql/workshops/${eventId}/${workshopNumber}`;
        const result = await apiCall(endpoint);
        const workshop = result.data;

        if (!workshop) {
            showToast('Workshop not found', 'error');
            return;
        }

        editingWorkshop = { event_id: eventId, workshop_number: workshopNumber };

        document.getElementById('workshop-event-select').value = workshop.event_id;
        document.getElementById('workshop-event-select').disabled = true; // Can't change event for weak entity
        document.getElementById('workshop-title').value = workshop.title;
        document.getElementById('workshop-description').value = workshop.description || '';
        document.getElementById('workshop-duration').value = workshop.duration || 60;
        document.getElementById('workshop-skill-level').value = workshop.skill_level || 'Beginner';
        document.getElementById('workshop-max-attendees').value = workshop.max_attendees || 30;

        document.getElementById('workshop-submit-btn').textContent = 'Update Workshop';
        document.getElementById('workshop-cancel-btn').style.display = 'inline-flex';

        document.getElementById('manage-workshops').scrollIntoView({ behavior: 'smooth' });

    } catch (error) {
        showToast(`Failed to load workshop: ${error.message}`, 'error');
    }
}

// Workshop Form Handler
document.getElementById('workshop-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const eventId = document.getElementById('workshop-event-select').value;
    if (!eventId) {
        showToast('Please select an event', 'error');
        return;
    }

    const workshopData = {
        event_id: parseInt(eventId),
        title: document.getElementById('workshop-title').value,
        description: document.getElementById('workshop-description').value,
        duration: parseInt(document.getElementById('workshop-duration').value),
        skill_level: document.getElementById('workshop-skill-level').value,
        max_attendees: parseInt(document.getElementById('workshop-max-attendees').value)
    };

    try {
        let result;
        if (editingWorkshop) {
            // Update existing workshop
            const endpoint = workshopDbMode === 'sql'
                ? `/workshops/${editingWorkshop.event_id}/${editingWorkshop.workshop_number}`
                : `/nosql/workshops/${editingWorkshop.event_id}/${editingWorkshop.workshop_number}`;
            result = await apiCall(endpoint, {
                method: 'PUT',
                body: JSON.stringify(workshopData)
            });
            showToast('Workshop updated successfully!', 'success');
        } else {
            // Create new workshop
            const endpoint = workshopDbMode === 'sql' ? '/workshops' : '/nosql/workshops';
            result = await apiCall(endpoint, {
                method: 'POST',
                body: JSON.stringify(workshopData)
            });
            showToast(result.message || 'Workshop created successfully!', 'success');
        }

        resetWorkshopForm();
        loadWorkshops();
        loadEventsForWorkshops();

    } catch (error) {
        showToast(`Failed to ${editingWorkshop ? 'update' : 'create'} workshop: ${error.message}`, 'error');
    }
});

// Cancel Edit Button
document.getElementById('workshop-cancel-btn').addEventListener('click', () => {
    resetWorkshopForm();
});

async function deleteWorkshop(eventId, workshopNumber) {
    if (!confirm('Are you sure you want to delete this workshop?')) return;

    try {
        const endpoint = workshopDbMode === 'sql'
            ? `/workshops/${eventId}/${workshopNumber}`
            : `/nosql/workshops/${eventId}/${workshopNumber}`;
        await apiCall(endpoint, { method: 'DELETE' });
        showToast('Workshop deleted successfully', 'success');
        loadWorkshops();
        loadEventsForWorkshops();
    } catch (error) {
        showToast(`Failed to delete: ${error.message}`, 'error');
    }
}

// ==================== ANALYTICS (Student 1) ====================

async function loadSubmissionAnalytics() {
    const startDate = document.getElementById('filter-start-date').value;
    const endDate = document.getElementById('filter-end-date').value;
    
    try {
        const data = await apiCall(`/analytics/submissions?startDate=${startDate}&endDate=${endDate}`);
        
        // Summary
        const summaryHtml = `
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="value">${data.summary.totalRecords}</div>
                    <div class="label">Total Records</div>
                </div>
                <div class="summary-item">
                    <div class="value">${data.summary.uniqueSubmissions}</div>
                    <div class="label">Unique Submissions</div>
                </div>
                <div class="summary-item">
                    <div class="value">${data.summary.uniqueParticipants}</div>
                    <div class="label">Unique Participants</div>
                </div>
            </div>
            <h4>Technology Usage</h4>
            <p>${Object.entries(data.summary.technologyUsage).map(([tech, count]) => 
                `<span class="badge badge-info">${tech}: ${count}</span>`
            ).join(' ')}</p>
        `;
        document.getElementById('analytics-s1-summary').innerHTML = summaryHtml;
        
        // Table
        const tableHtml = data.data.length > 0
            ? `<div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Project</th>
                            <th>Event</th>
                            <th>Participant</th>
                            <th>Email</th>
                            <th>Submitted</th>
                            <th>Days Since Reg</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.data.map(r => `
                            <tr>
                                <td>${r.project_name}</td>
                                <td>${r.event_name || 'Unassigned'}</td>
                                <td>${r.participant_first_name} ${r.participant_last_name}</td>
                                <td>${r.participant_email}</td>
                                <td>${new Date(r.submission_time).toLocaleString()}</td>
                                <td>${r.days_since_registration}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
               </div>`
            : '<p class="empty-state">No submissions found for the selected date range</p>';
        
        document.getElementById('analytics-s1-table').innerHTML = tableHtml;
        
    } catch (error) {
        showToast(`Failed to load analytics: ${error.message}`, 'error');
    }
}

// ==================== ANALYTICS (Student 2) ====================

// Toggle database mode for analytics S2
function setAnalyticsS2DbMode(mode) {
    analyticsS2DbMode = mode;

    // Update toggle button states
    const toggleBtns = document.querySelectorAll('#analytics-s2 .toggle-btn');
    toggleBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.db === mode);
    });

    // Update hint text
    const hint = document.getElementById('analytics-s2-db-hint');
    if (hint) {
        const dbName = mode === 'sql' ? 'SQL (MariaDB)' : 'NoSQL (MongoDB)';
        hint.innerHTML = `Currently using: <strong>${dbName}</strong>`;
    }

    // Reload analytics data
    loadWorkshopAnalytics();
}

async function loadWorkshopAnalytics() {
    const skillLevel = document.getElementById('filter-skill-level').value;

    try {
        const endpoint = analyticsS2DbMode === 'sql'
            ? `/analytics/workshops?skillLevel=${skillLevel}`
            : `/nosql/analytics/workshops?skillLevel=${skillLevel}`;
        const data = await apiCall(endpoint);

        // Summary section
        const summaryHtml = `
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="value">${data.summary.totalWorkshops}</div>
                    <div class="label">Total Workshops</div>
                </div>
                <div class="summary-item">
                    <div class="value">${data.summary.uniqueEvents}</div>
                    <div class="label">Events with Workshops</div>
                </div>
                <div class="summary-item">
                    <div class="value">${data.summary.averageDuration} min</div>
                    <div class="label">Avg Duration</div>
                </div>
            </div>
            <h4>Skill Level Distribution</h4>
            <p>${Object.entries(data.summary.skillDistribution).map(([level, count]) =>
                `<span class="badge ${level === 'Beginner' ? 'badge-success' : level === 'Intermediate' ? 'badge-warning' : 'badge-info'}">${level}: ${count}</span>`
            ).join(' ')}</p>
        `;
        document.getElementById('analytics-s2-summary').innerHTML = summaryHtml;

        // Table section
        const tableHtml = data.data.length > 0
            ? `<div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Workshop #</th>
                            <th>Title</th>
                            <th>Event</th>
                            <th>Skill Level</th>
                            <th>Duration</th>
                            <th>Max Attendees</th>
                            <th>Venue</th>
                            <th>Venue Capacity</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.data.map(w => `
                            <tr>
                                <td>${w.workshop_number}</td>
                                <td>${w.workshop_title}</td>
                                <td>${w.event_name}</td>
                                <td><span class="badge ${w.skill_level === 'Beginner' ? 'badge-success' : w.skill_level === 'Intermediate' ? 'badge-warning' : 'badge-info'}">${w.skill_level}</span></td>
                                <td>${w.duration} min</td>
                                <td>${w.max_attendees}</td>
                                <td>${w.venue_name || 'N/A'}</td>
                                <td>${w.venue_capacity || 'N/A'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
               </div>`
            : '<p class="empty-state">No workshops found for the selected skill level</p>';

        document.getElementById('analytics-s2-table').innerHTML = tableHtml;

    } catch (error) {
        showToast(`Failed to load analytics: ${error.message}`, 'error');
    }
}

// ==================== DATA MANAGEMENT ====================

async function loadDbStats() {
    try {
        const data = await apiCall('/data/stats');
        
        const excludedTables = ['Creates', 'Evaluates', 'Supports'];
        const filteredStats = Object.entries(data.stats).filter(([table]) => !excludedTables.includes(table));

        const statsHtml = `
            <div class="summary-grid">
                ${filteredStats.map(([table, count]) => `
                    <div class="summary-item">
                        <div class="value">${count}</div>
                        <div class="label">${table}</div>
                    </div>
                `).join('')}
            </div>
        `;
        
        document.getElementById('db-stats').innerHTML = statsHtml;
        
    } catch (error) {
        document.getElementById('db-stats').innerHTML = `
            <div style="color: #c53030; padding: 1rem; background: #fed7d7; border-radius: 6px;">
                <strong>Error:</strong> ${error.message}
                <br><br>
                <strong>Troubleshooting:</strong>
                <ol style="margin-top: 0.5rem; margin-left: 1.5rem;">
                    <li>Make sure Docker is running</li>
                    <li>Run: <code>docker-compose up --build</code></li>
                    <li>Wait for "Server running on port 3000" message</li>
                    <li>Check terminal for database connection errors</li>
                </ol>
            </div>
        `;
    }

    try {
        const mongoData = await apiCall('/nosql/stats');
        const mongoHtml = `
            <div class="summary-grid">
                ${Object.entries(mongoData.stats).map(([collection, count]) => `
                    <div class="summary-item">
                        <div class="value">${count}</div>
                        <div class="label">${collection}</div>
                    </div>
                `).join('')}
            </div>
        `;
        document.getElementById('mongo-stats').innerHTML = mongoHtml;
    } catch (error) {
        document.getElementById('mongo-stats').innerHTML = `
            <div style="color: #c53030; padding: 1rem; background: #fed7d7; border-radius: 6px;">
                <strong>Error:</strong> ${error.message}
            </div>
        `;
    }
}

// Import Data Button Handler
document.getElementById('import-data-btn').addEventListener('click', async () => {
    if (!confirm('This will replace ALL existing data with new randomized data. Are you sure?')) {
        return;
    }
    
    const btn = document.getElementById('import-data-btn');
    const statusDiv = document.getElementById('import-status');
    
    btn.disabled = true;
    btn.textContent = 'Importing...';
    statusDiv.innerHTML = '<p class="loading">Generating and importing data...</p>';
    
    try {
        const result = await apiCall('/data/import', { method: 'POST' });
        
        const excludedTables = ['Creates', 'Evaluates', 'Supports'];
        const filteredStats = Object.entries(result.stats).filter(([table]) => !excludedTables.includes(table));

        statusDiv.innerHTML = `
            <p class="badge badge-success">Data imported successfully!</p>
            <div class="summary-grid" style="margin-top: 1rem;">
                ${filteredStats.map(([key, value]) => `
                    <div class="summary-item">
                        <div class="value">${value}</div>
                        <div class="label">${key}</div>
                    </div>
                `).join('')}
            </div>
        `;
        
        showToast('Data imported successfully!', 'success');
        loadDbStats();
        
    } catch (error) {
        statusDiv.innerHTML = `<p class="badge badge-error">Import failed: ${error.message}</p>`;
        showToast(`Import failed: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Import Data (Replace Existing)';
    }
});

// NoSQL Migration Button Handler
document.getElementById('migrate-nosql-btn').addEventListener('click', async () => {
    if (!confirm('This will clear MongoDB collections and migrate data from MySQL. Continue?')) {
        return;
    }

    const btn = document.getElementById('migrate-nosql-btn');
    const statusDiv = document.getElementById('migrate-status');

    btn.disabled = true;
    btn.textContent = 'Migrating...';
    statusDiv.innerHTML = '<p class="loading">Migrating data to MongoDB...</p>';

    try {
        const result = await apiCall('/nosql/migrate', { method: 'POST' });
        const statsEntries = Object.entries(result.stats || {});
        const warningEntries = statsEntries.filter(([key]) => key.startsWith('warnings_'));
        const mainEntries = statsEntries.filter(([key]) => !key.startsWith('warnings_'));
        const hasWarnings = warningEntries.some(([, value]) => value > 0);

        statusDiv.innerHTML = `
            <p class="badge badge-success">Migration complete!</p>
            <div class="summary-grid" style="margin-top: 1rem;">
                ${mainEntries.map(([key, value]) => `
                    <div class="summary-item">
                        <div class="value">${value}</div>
                        <div class="label">${key}</div>
                    </div>
                `).join('')}
                ${hasWarnings ? warningEntries.map(([key, value]) => `
                    <div class="summary-item">
                        <div class="value">${value}</div>
                        <div class="label">${key}</div>
                    </div>
                `).join('') : ''}
            </div>
        `;
        showToast('MongoDB migration completed!', 'success');
        loadDbStats();
    } catch (error) {
        statusDiv.innerHTML = `<p class="badge badge-error">Migration failed: ${error.message}</p>`;
        showToast(`Migration failed: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Migrate to MongoDB';
    }
});
