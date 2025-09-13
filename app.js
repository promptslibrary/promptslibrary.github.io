/**
 * Python Prompts Viewer - Main Application
 * A modern, responsive web application for browsing Python programming prompts
 */

'use strict';

// Application State Management
const AppState = {
  promptsData: null,
  currentSelection: null,
  expandedCategories: new Set(),
  isLoading: true,
  searchQuery: '',
  theme: 'auto'
};

// DOM Elements Cache
const DOM = {
  // Header elements
  searchInput: null,
  downloadBtn: null,
  
  // Sidebar elements
  sidebarContent: null,
  taskCounter: null,
  
  // Task details elements
  taskTitle: null,
  taskDescription: null,
  taskContent: null,
  
  // Other elements
  notificationContainer: null,
  loadingOverlay: null,
  errorModal: null,
  themeToggle: null,
  
  // Initialize DOM element references
  init() {
    this.searchInput = document.getElementById('searchInput');
    this.downloadBtn = document.getElementById('downloadJson');
    this.sidebarContent = document.getElementById('sidebarContent');
    this.taskCounter = document.getElementById('taskCounter');
    this.taskTitle = document.getElementById('taskTitle');
    this.taskDescription = document.getElementById('taskDescription');
    this.taskContent = document.getElementById('taskContent');
    this.notificationContainer = document.getElementById('notificationContainer');
    this.loadingOverlay = document.getElementById('loadingOverlay');
    this.errorModal = document.getElementById('errorModal');
    this.themeToggle = document.getElementById('toggleTheme');
    
    // Validate critical elements
    const criticalElements = [
      'searchInput', 'downloadBtn', 'sidebarContent', 'taskTitle', 'taskContent'
    ];
    
    for (const elementName of criticalElements) {
      if (!this[elementName]) {
        console.error(`Critical element missing: ${elementName}`);
      }
    }
  }
};

// Utility Functions
const Utils = {
  /**
   * Escapes HTML characters to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Debounces function calls
   */
  debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        timeout = null;
        if (!immediate) func(...args);
      };
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func(...args);
    };
  },

  /**
   * Throttles function calls
   */
  throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  /**
   * Downloads blob as file
   */
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Copies text to clipboard
   */
  async copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
      }
    } catch (err) {
      console.error('Failed to copy text: ', err);
      return false;
    }
  },

  /**
   * Formats text for display
   */
  formatText(text, maxLength = 100) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  },

  /**
   * Sanitizes filename for download
   */
  sanitizeFilename(filename) {
    return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  },

  /**
   * Deep clones an object
   */
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => this.deepClone(item));
    if (typeof obj === 'object') {
      const clonedObj = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          clonedObj[key] = this.deepClone(obj[key]);
        }
      }
      return clonedObj;
    }
  }
};

// Notification System
const NotificationSystem = {
  /**
   * Shows a notification
   */
  show(message, type = 'success', duration = 4000) {
    if (!DOM.notificationContainer) {
      console.warn('Notification container not found');
      return;
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'polite');
    
    // Add icon based on type
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    notification.innerHTML = `
      <span class="notification-icon" aria-hidden="true">${icons[type] || icons.info}</span>
      <span class="notification-message">${Utils.escapeHtml(message)}</span>
    `;

    DOM.notificationContainer.appendChild(notification);

    // Trigger show animation
    requestAnimationFrame(() => {
      notification.classList.add('show');
    });

    // Auto remove
    setTimeout(() => {
      this.remove(notification);
    }, duration);

    // Allow manual dismiss
    notification.addEventListener('click', () => {
      this.remove(notification);
    });
  },

  /**
   * Removes a notification
   */
  remove(notification) {
    if (notification && notification.parentNode) {
      notification.classList.remove('show');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }
  },

  /**
   * Convenience methods
   */
  success(message, duration) {
    this.show(message, 'success', duration);
  },

  error(message, duration) {
    this.show(message, 'error', duration);
  },

  warning(message, duration) {
    this.show(message, 'warning', duration);
  },

  info(message, duration) {
    this.show(message, 'info', duration);
  }
};

// Loading System
const LoadingSystem = {
  /**
   * Shows loading overlay
   */
  show(message = 'Loading...') {
    if (DOM.loadingOverlay) {
      const loadingText = DOM.loadingOverlay.querySelector('p');
      if (loadingText) {
        loadingText.textContent = message;
      }
      DOM.loadingOverlay.classList.add('show');
    }
  },

  /**
   * Hides loading overlay
   */
  hide() {
    if (DOM.loadingOverlay) {
      DOM.loadingOverlay.classList.remove('show');
    }
  }
};

// Data Management
const DataManager = {
  /**
   * Loads prompts from JSON file or uses embedded data
   */
  async loadPrompts() {
    try {
      LoadingSystem.show('Loading prompts...');
      
      // Try to load from external JSON file first
      let response;
      try {
        response = await fetch('./prompts.json');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        this.validatePromptsData(data);
        AppState.promptsData = data;
        NotificationSystem.success('Prompts loaded successfully');
      } catch (fetchError) {
        console.log('External prompts.json not available, using embedded data:', fetchError.message);
        
        // Use embedded fallback data
        AppState.promptsData = this.getEmbeddedData();
        NotificationSystem.info('Using sample data (prompts.json not found)');
      }
      
      AppState.isLoading = false;
      LoadingSystem.hide();
      
      // Update UI
      UI.updateTaskCounter();
      UI.renderSidebar();
      
      // Auto-expand first category and select first task
      this.initializeDefaultSelection();
      
    } catch (error) {
      console.error('Error loading prompts:', error);
      AppState.isLoading = false;
      LoadingSystem.hide();
      
      this.handleLoadError(error);
    }
  },

  /**
   * Validates the structure of prompts data
   */
  validatePromptsData(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid prompts data: not an object');
    }
    
    for (const [categoryName, category] of Object.entries(data)) {
      if (!category || typeof category !== 'object') {
        throw new Error(`Invalid category: ${categoryName}`);
      }
      
      for (const [taskName, task] of Object.entries(category)) {
        if (!task || typeof task !== 'object') {
          throw new Error(`Invalid task: ${taskName} in category ${categoryName}`);
        }
        
        if (task.steps && !Array.isArray(task.steps)) {
          throw new Error(`Invalid steps for task: ${taskName}`);
        }
      }
    }
  },

  /**
   * Handles loading errors
   */
  handleLoadError(error) {
    NotificationSystem.error('Failed to load prompts data');
    
    // Show error in main content area
    if (DOM.taskContent) {
      DOM.taskContent.innerHTML = `
        <div class="error-state">
          <div class="error-icon" aria-hidden="true">⚠️</div>
          <h2>Loading Error</h2>
          <p>Unable to load prompts data: ${Utils.escapeHtml(error.message)}</p>
          <button class="btn btn-primary" onclick="DataManager.loadPrompts()">
            🔄 Retry Loading
          </button>
        </div>
      `;
    }
    
    // Update sidebar
    if (DOM.sidebarContent) {
      DOM.sidebarContent.innerHTML = `
        <div class="loading error">
          <div class="error-icon" aria-hidden="true">❌</div>
          <span>Error loading data</span>
        </div>
      `;
    }
  },

  /**
   * Initializes default selection
   */
  initializeDefaultSelection() {
    if (!AppState.promptsData) return;
    
    const categories = Object.keys(AppState.promptsData);
    if (categories.length === 0) return;
    
    // Expand first category
    const firstCategory = categories[0];
    AppState.expandedCategories.add(firstCategory);
    
    // Select first task in first category
    const firstCategoryTasks = AppState.promptsData[firstCategory];
    const firstTask = Object.keys(firstCategoryTasks)[0];
    
    if (firstTask) {
      setTimeout(() => {
        UI.selectTask(firstCategory, firstTask);
      }, 100);
    }
  },

  /**
   * Gets embedded sample data as fallback
   */
  getEmbeddedData() {
    return {
      "File Operations": {
        "1.1 Text File Inspector & Reporter": {
          "description": "Python script using os and chardet",
          "steps": [
            "Read all .txt files from a specified directory.",
            "Automatically detect each file's encoding using chardet, defaulting to UTF-8 if detection fails or is uncertain.",
            "Print the first five lines of each file to the console.",
            "Skip empty files and log any unreadable files to an errors.log file.",
            "Generate a summary report in JSON format file_inspection_report.json containing for each file: filename, encoding_used, file_size_bytes, and lines_read.",
            "Provide a final console summary showing the total number of files processed and skipped."
          ]
        },
        "1.2 Multi-Keyword File Searcher": {
          "description": "Python tool using argparse and csv",
          "steps": [
            "Accept multiple keywords from the user via command-line arguments.",
            "Search through all text files in a directory and its subdirectories for these keywords.",
            "For each match, record the filename, line_number, and a context snippet the matching line ±2 lines in search_results.csv.",
            "Skip files larger than 50 MB to maintain performance.",
            "Handle files that cannot be opened permission errors, corruption by logging them to a separate file.",
            "Generate a final summary showing the total number of matches found per keyword."
          ]
        }
      },
      "PDF Tools": {
        "1.10 PDF Keyword Search & Reporter": {
          "description": "Python utility using pypdf2 or pdfplumber",
          "steps": [
            "Searches for a user-provided keyword across all pages of all PDFs in a directory.",
            "For each match, records the filename, page_number, and a text snippet surrounding the keyword.",
            "Saves all results to pdf_matches.json.",
            "Handles encrypted PDFs by skipping them and logging a warning.",
            "Generates a summary showing: files_scanned, pages_processed, total_matches_found."
          ]
        }
      },
      "Text Analysis & Automation": {
        "1.17 Console Pattern Generator": {
          "description": "Python script using argparse",
          "steps": [
            "Generates text patterns, horizontal/vertical lines, squares, and pyramids from a user-provided character.",
            "Validates that the input is a single character.",
            "Allows the user to specify the pattern size width/height.",
            "Provides an output option to save the pattern to a text file.",
            "Displays the pattern in the console.",
            "Generates a summary log showing: pattern_type, size, output_file if used."
          ]
        }
      }
    };
  }
};

// User Interface Management
const UI = {
  /**
   * Renders the sidebar with categories and tasks
   */
  renderSidebar() {
    if (!DOM.sidebarContent || !AppState.promptsData) {
      return;
    }

    const categories = Object.keys(AppState.promptsData);
    
    if (categories.length === 0) {
      DOM.sidebarContent.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon" aria-hidden="true">📁</div>
          <p>No categories found</p>
        </div>
      `;
      return;
    }

    const sidebarHTML = categories.map(categoryName => {
      const tasks = AppState.promptsData[categoryName];
      const taskKeys = Object.keys(tasks);
      const isExpanded = AppState.expandedCategories.has(categoryName);
      const shouldDisplay = this.shouldShowCategory(categoryName, tasks);
      
      if (!shouldDisplay) {
        return '';
      }
      
      const visibleTasks = taskKeys.filter(taskKey => 
        this.shouldShowTask(taskKey, tasks[taskKey])
      );
      
      const tasksHTML = visibleTasks.map(taskKey => {
        const task = tasks[taskKey];
        const isActive = AppState.currentSelection && 
                        AppState.currentSelection.category === categoryName && 
                        AppState.currentSelection.taskKey === taskKey;
        
        return `
          <li class="task-item ${isActive ? 'active' : ''}" 
              data-category="${Utils.escapeHtml(categoryName)}" 
              data-task="${Utils.escapeHtml(taskKey)}"
              role="button"
              tabindex="0"
              aria-pressed="${isActive}">
            <strong>${Utils.escapeHtml(taskKey)}</strong>
            ${task.description ? `<br><small>${Utils.escapeHtml(Utils.formatText(task.description, 80))}</small>` : ''}
          </li>
        `;
      }).join('');

      return `
        <div class="category" style="${shouldDisplay ? '' : 'display: none;'}">
          <button class="category-header ${isExpanded ? '' : 'collapsed'}" 
                  data-category="${Utils.escapeHtml(categoryName)}"
                  aria-expanded="${isExpanded}"
                  aria-controls="tasks-${Utils.escapeHtml(categoryName)}">
            <span class="category-name">
              <span class="category-icon" aria-hidden="true">${isExpanded ? '📂' : '📁'}</span>
              ${Utils.escapeHtml(categoryName)}
            </span>
            <span class="category-count">(${visibleTasks.length})</span>
          </button>
          <ul class="task-list ${isExpanded ? 'expanded' : ''}" 
              id="tasks-${Utils.escapeHtml(categoryName)}"
              role="group"
              aria-labelledby="category-${Utils.escapeHtml(categoryName)}">
            ${tasksHTML}
          </ul>
        </div>
      `;
    }).join('');

    DOM.sidebarContent.innerHTML = sidebarHTML || `
      <div class="empty-state">
        <div class="empty-icon" aria-hidden="true">🔍</div>
        <p>No tasks match your search</p>
      </div>
    `;

    this.attachSidebarEvents();
  },

  /**
   * Determines if a category should be shown based on search
   */
  shouldShowCategory(categoryName, tasks) {
    if (!AppState.searchQuery) return true;
    
    const searchLower = AppState.searchQuery.toLowerCase().trim();
    
    // Check category name
    if (categoryName.toLowerCase().includes(searchLower)) {
      return true;
    }
    
    // Check if any task in category matches
    return Object.keys(tasks).some(taskKey => 
      this.shouldShowTask(taskKey, tasks[taskKey])
    );
  },

  /**
   * Determines if a task should be shown based on search
   */
  shouldShowTask(taskKey, task) {
    if (!AppState.searchQuery) return true;
    
    const searchLower = AppState.searchQuery.toLowerCase().trim();
    
    const searchContent = [
      taskKey,
      task.description || '',
      ...(task.steps || [])
    ].join(' ').toLowerCase();
    
    return searchContent.includes(searchLower);
  },

  /**
   * Attaches event listeners to sidebar elements
   */
  attachSidebarEvents() {
    if (!DOM.sidebarContent) return;

    // Category toggle events
    DOM.sidebarContent.querySelectorAll('.category-header').forEach(header => {
      header.addEventListener('click', this.handleCategoryToggle);
      header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.handleCategoryToggle(e);
        }
      });
    });

    // Task selection events
    DOM.sidebarContent.querySelectorAll('.task-item').forEach(item => {
      item.addEventListener('click', this.handleTaskSelection);
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.handleTaskSelection(e);
        }
      });
    });
  },

  /**
   * Handles category toggle
   */
  handleCategoryToggle(event) {
    const category = event.currentTarget.dataset.category;
    if (!category) return;
    
    if (AppState.expandedCategories.has(category)) {
      AppState.expandedCategories.delete(category);
    } else {
      AppState.expandedCategories.add(category);
    }
    
    UI.renderSidebar();
  },

  /**
   * Handles task selection
   */
  handleTaskSelection(event) {
    const target = event.currentTarget;
    const category = target.dataset.category;
    const taskKey = target.dataset.task;
    
    if (category && taskKey) {
      UI.selectTask(category, taskKey);
    }
  },

  /**
   * Selects and displays a specific task
   */
  selectTask(category, taskKey) {
    if (!AppState.promptsData || !AppState.promptsData[category] || !AppState.promptsData[category][taskKey]) {
      NotificationSystem.error('Task not found');
      return;
    }

    const task = AppState.promptsData[category][taskKey];
    AppState.currentSelection = { category, taskKey, task };
    
    // Update header
    DOM.taskTitle.textContent = taskKey;
    DOM.taskDescription.textContent = task.description || 'No description available';
    
    // Render task content
    this.renderTaskContent(taskKey, task);
    
    // Update sidebar to reflect selection
    this.renderSidebar();
    
    // Scroll task details into view on mobile
    if (window.innerWidth < 768) {
      DOM.taskTitle.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  },

  /**
   * Renders the task content area
   */
  renderTaskContent(taskKey, task) {
    if (!DOM.taskContent) return;
    
    const hasSteps = task.steps && Array.isArray(task.steps) && task.steps.length > 0;
    const stepCount = hasSteps ? task.steps.length : 0;
    
    const metaHTML = `
      <div class="task-meta">
        <span class="chip">
          <span aria-hidden="true">📝</span>
          ${Utils.escapeHtml(taskKey)}
        </span>
        <span class="chip">
          <span aria-hidden="true">🔧</span>
          ${Utils.escapeHtml(task.description || 'No description')}
        </span>
        <span class="chip">
          <span aria-hidden="true">📋</span>
          ${stepCount} step${stepCount !== 1 ? 's' : ''}
        </span>
      </div>
    `;

    const stepsHTML = hasSteps ? `
      <div class="steps-section">
        <h3>
          <span aria-hidden="true">📋</span>
          Implementation Steps
        </h3>
        <ol class="steps-list" role="list">
          ${task.steps.map(step => `
            <li role="listitem">${Utils.escapeHtml(step)}</li>
          `).join('')}
        </ol>
      </div>
    ` : `
      <div class="empty-state">
        <div class="empty-icon" aria-hidden="true">⚠️</div>
        <h3>No Steps Available</h3>
        <p>This task doesn't have detailed implementation steps yet.</p>
      </div>
    `;

    const actionsHTML = `
      <div class="action-buttons">
        <button class="btn btn-primary" id="copyPrompt" aria-describedby="copy-help">
          <span aria-hidden="true">📋</span>
          <span class="btn-text">Copy Prompt</span>
        </button>
        <button class="btn btn-secondary" id="downloadTask" aria-describedby="download-help">
          <span aria-hidden="true">💾</span>
          <span class="btn-text">Download Task JSON</span>
        </button>
        <div id="copy-help" class="visually-hidden">Copy this task's prompt text to clipboard</div>
        <div id="download-help" class="visually-hidden">Download this task as a JSON file</div>
      </div>
    `;

    DOM.taskContent.innerHTML = metaHTML + stepsHTML + actionsHTML;
    this.attachTaskEvents();
  },

  /**
   * Attaches event listeners to task action buttons
   */
  attachTaskEvents() {
    const copyBtn = document.getElementById('copyPrompt');
    const downloadBtn = document.getElementById('downloadTask');

    if (copyBtn) {
      copyBtn.addEventListener('click', this.handleCopyPrompt);
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', this.handleDownloadTask);
    }
  },

  /**
   * Handles copying prompt to clipboard
   */
  async handleCopyPrompt() {
    if (!AppState.currentSelection) {
      NotificationSystem.error('No task selected');
      return;
    }
    
    const promptText = UI.buildPromptText(
      AppState.currentSelection.taskKey,
      AppState.currentSelection.task
    );
    
    const success = await Utils.copyToClipboard(promptText);
    
    if (success) {
      NotificationSystem.success('✅ Prompt copied to clipboard!');
    } else {
      NotificationSystem.error('❌ Failed to copy prompt');
    }
  },

  /**
   * Handles downloading task as JSON
   */
  handleDownloadTask() {
    if (!AppState.currentSelection) {
      NotificationSystem.error('No task selected');
      return;
    }
    
    try {
      const taskData = {
        [AppState.currentSelection.taskKey]: AppState.currentSelection.task
      };
      
      const jsonString = JSON.stringify(taskData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      const filename = Utils.sanitizeFilename(
        `${AppState.currentSelection.taskKey}.json`
      );
      
      Utils.downloadBlob(blob, filename);
      NotificationSystem.success('📥 Task downloaded successfully!');
    } catch (error) {
      console.error('Download failed:', error);
      NotificationSystem.error('Failed to download task');
    }
  },

  /**
   * Builds formatted prompt text
   */
  buildPromptText(taskKey, task) {
    const lines = [
      `# ${taskKey}`,
      '',
      task.description ? `**Description:** ${task.description}` : '',
      ''
    ];

    if (task.steps && task.steps.length > 0) {
      lines.push('## Implementation Steps:');
      lines.push('');
      task.steps.forEach((step, index) => {
        lines.push(`${index + 1}. ${step}`);
      });
    } else {
      lines.push('*No implementation steps available.*');
    }

    lines.push('');
    lines.push('---');
    lines.push('*Generated from Python Prompts Collection*');

    return lines.filter(line => line !== '').join('\n');
  },

  /**
   * Updates the task counter display
   */
  updateTaskCounter() {
    if (!DOM.taskCounter || !AppState.promptsData) return;
    
    let totalTasks = 0;
    let totalCategories = 0;
    
    for (const [categoryName, category] of Object.entries(AppState.promptsData)) {
      totalCategories++;
      totalTasks += Object.keys(category).length;
    }
    
    DOM.taskCounter.textContent = `${totalCategories} categories, ${totalTasks} tasks`;
  },

  /**
   * Handles search functionality
   */
  handleSearch(query) {
    AppState.searchQuery = query.trim();
    
    if (AppState.searchQuery) {
      // Expand all categories when searching
      Object.keys(AppState.promptsData || {}).forEach(category => {
        if (UI.shouldShowCategory(category, AppState.promptsData[category])) {
          AppState.expandedCategories.add(category);
        }
      });
    }
    
    this.renderSidebar();
    
    // Update counter for search results
    if (AppState.searchQuery && DOM.taskCounter) {
      let visibleTasks = 0;
      let visibleCategories = 0;
      
      for (const [categoryName, category] of Object.entries(AppState.promptsData || {})) {
        if (this.shouldShowCategory(categoryName, category)) {
          visibleCategories++;
          visibleTasks += Object.keys(category).filter(taskKey => 
            this.shouldShowTask(taskKey, category[taskKey])
          ).length;
        }
      }
      
      DOM.taskCounter.innerHTML = `
        <span>Search: ${visibleCategories} categories, ${visibleTasks} tasks</span>
        <button class="clear-search" onclick="SearchManager.clearSearch()" aria-label="Clear search">
          <span aria-hidden="true">✕</span>
        </button>
      `;
    } else {
      this.updateTaskCounter();
    }
  }
};

// Search Management
const SearchManager = {
  /**
   * Initializes search functionality
   */
  init() {
    if (!DOM.searchInput) return;
    
    // Debounced search
    const debouncedSearch = Utils.debounce((query) => {
      UI.handleSearch(query);
    }, 300);
    
    DOM.searchInput.addEventListener('input', (e) => {
      debouncedSearch(e.target.value);
    });
    
    // Search on Enter key
    DOM.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        UI.handleSearch(e.target.value);
      }
    });
  },

  /**
   * Clears the search
   */
  clearSearch() {
    if (DOM.searchInput) {
      DOM.searchInput.value = '';
      UI.handleSearch('');
      DOM.searchInput.focus();
    }
  },

  /**
   * Focuses the search input
   */
  focusSearch() {
    if (DOM.searchInput) {
      DOM.searchInput.focus();
      DOM.searchInput.select();
    }
  }
};

// Theme Management
const ThemeManager = {
  /**
   * Initializes theme functionality
   */
  init() {
    // Load saved theme
    const savedTheme = localStorage.getItem('theme') || 'auto';
    this.setTheme(savedTheme);
    
    // Set up theme toggle
    if (DOM.themeToggle) {
      DOM.themeToggle.addEventListener('click', this.toggleTheme);
    }
  },

  /**
   * Sets the theme
   */
  setTheme(theme) {
    AppState.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    
    if (DOM.themeToggle) {
      const themeIcon = DOM.themeToggle.querySelector('#themeIcon');
      if (themeIcon) {
        const icons = { auto: '🌗', light: '☀️', dark: '🌙' };
        themeIcon.textContent = icons[theme] || icons.auto;
      }
    }
    
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {
      console.warn('Could not save theme to localStorage:', e);
    }
  },

  /**
   * Toggles between themes
   */
  toggleTheme() {
    const themes = ['auto', 'light', 'dark'];
    const currentIndex = themes.indexOf(AppState.theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    
    ThemeManager.setTheme(nextTheme);
    NotificationSystem.info(`Theme changed to ${nextTheme}`);
  }
};

// Download Manager
const DownloadManager = {
  /**
   * Downloads the complete JSON data
   */
  async downloadJson() {
    try {
      let jsonData;
      
      if (AppState.promptsData) {
        jsonData = JSON.stringify(AppState.promptsData, null, 2);
      } else {
        // Fallback to embedded data
        jsonData = JSON.stringify(DataManager.getEmbeddedData(), null, 2);
      }
      
      const blob = new Blob([jsonData], { type: 'application/json' });
      const filename = `python-prompts-${new Date().toISOString().split('T')[0]}.json`;
      
      Utils.downloadBlob(blob, filename);
      NotificationSystem.success('📥 JSON file downloaded successfully!');
    } catch (error) {
      console.error('Download failed:', error);
      NotificationSystem.error('❌ Failed to download JSON file');
    }
  }
};

// Keyboard Shortcuts Manager
const KeyboardManager = {
  /**
   * Initializes keyboard shortcuts
   */
  init() {
    document.addEventListener('keydown', this.handleKeyDown);
  },

  /**
   * Handles keyboard shortcuts
   */
  handleKeyDown(e) {
    // Only handle shortcuts when not typing in input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      // Allow Escape to clear search
      if (e.key === 'Escape' && e.target === DOM.searchInput) {
        SearchManager.clearSearch();
      }
      return;
    }
    
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'f':
          e.preventDefault();
          SearchManager.focusSearch();
          break;
          
        case 'c':
          if (AppState.currentSelection && document.getElementById('copyPrompt')) {
            e.preventDefault();
            UI.handleCopyPrompt();
          }
          break;
          
        case 'd':
          if (AppState.currentSelection && document.getElementById('downloadTask')) {
            e.preventDefault();
            UI.handleDownloadTask();
          }
          break;
          
        case 'j':
          e.preventDefault();
          DownloadManager.downloadJson();
          break;
      }
    }
    
    // Non-modifier key shortcuts
    switch (e.key) {
      case 'Escape':
        SearchManager.clearSearch();
        break;
        
      case '/':
        if (e.target !== DOM.searchInput) {
          e.preventDefault();
          SearchManager.focusSearch();
        }
        break;
    }
  }
};

// Error Handling
const ErrorHandler = {
  /**
   * Global error handler
   */
  init() {
    window.addEventListener('error', this.handleError);
    window.addEventListener('unhandledrejection', this.handlePromiseRejection);
  },

  /**
   * Handles JavaScript errors
   */
  handleError(event) {
    console.error('Application error:', event.error);
    NotificationSystem.error('An unexpected error occurred');
  },

  /**
   * Handles unhandled promise rejections
   */
  handlePromiseRejection(event) {
    console.error('Unhandled promise rejection:', event.reason);
    NotificationSystem.error('An operation failed');
  }
};

// Application Initialization
const App = {
  /**
   * Initializes the entire application
   */
  async init() {
    try {
      console.log('Initializing Python Prompts Viewer...');
      
      // Initialize DOM references
      DOM.init();
      
      // Initialize all managers
      ErrorHandler.init();
      ThemeManager.init();
      SearchManager.init();
      KeyboardManager.init();
      
      // Attach main event listeners
      this.attachEventListeners();
      
      // Load data and render UI
      await DataManager.loadPrompts();
      
      // Show success message
      console.log('Application initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize application:', error);
      NotificationSystem.error('Failed to initialize application');
    }
  },

  /**
   * Attaches main event listeners
   */
  attachEventListeners() {
    // Download button
    if (DOM.downloadBtn) {
      DOM.downloadBtn.addEventListener('click', DownloadManager.downloadJson);
    }
    
    // Online/offline status
    window.addEventListener('online', () => {
      NotificationSystem.success('🌐 Connection restored');
    });
    
    window.addEventListener('offline', () => {
      NotificationSystem.info('📶 Working offline');
    });
    
    // Prevent form submission on search
    const searchForm = DOM.searchInput?.closest('form');
    if (searchForm) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
      });
    }
  }
};

// Modal Management (for error dialogs, etc.)
const ModalManager = {
  /**
   * Shows error modal
   */
  showError(title, message) {
    if (!DOM.errorModal) return;
    
    const titleElement = DOM.errorModal.querySelector('#errorTitle');
    const messageElement = DOM.errorModal.querySelector('#errorMessage');
    
    if (titleElement) titleElement.textContent = title;
    if (messageElement) messageElement.textContent = message;
    
    DOM.errorModal.classList.remove('hidden');
    DOM.errorModal.classList.add('show');
    
    // Focus management
    const closeButton = DOM.errorModal.querySelector('.modal-close');
    if (closeButton) closeButton.focus();
  },

  /**
   * Closes error modal
   */
  closeError() {
    if (!DOM.errorModal) return;
    
    DOM.errorModal.classList.remove('show');
    setTimeout(() => {
      DOM.errorModal.classList.add('hidden');
    }, 300);
  }
};

// Global functions for HTML event handlers
window.closeErrorModal = () => ModalManager.closeError();
window.DataManager = DataManager;
window.SearchManager = SearchManager;
window.UI = UI;

// Initialize application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', App.init);
} else {
  // DOM is already loaded
  App.init();
}

// Export for potential module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    App,
    DataManager,
    UI,
    Utils,
    NotificationSystem,
    ThemeManager,
    SearchManager,
    KeyboardManager
  };
}