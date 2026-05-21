'use strict';

/**
 * UI Module — DOM rendering, event delegation, toasts, modals
 */

const UI = (() => {
    const CATEGORY_ICONS = {
        passwords: '🔑',
        apikeys: '⚙️',
        bank: '🏦',
        cards: '💳',
        notes: '📝',
        identities: '👤',
        licenses: '📜',
        sshkeys: '🔐',
        recovery: '🔄',
        custom: '📌'
    };

    const CATEGORY_LABELS = {
        passwords: 'Password',
        apikeys: 'API Key',
        bank: 'Bank Account',
        cards: 'Card',
        notes: 'Note',
        identities: 'Identity',
        licenses: 'License',
        sshkeys: 'SSH Key',
        recovery: 'Recovery Codes',
        custom: 'Custom'
    };

    let currentEditCategory = 'passwords';
    let currentEditId = null;

    // ─── Toast Notifications ───────────────────────────────────────

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close">&times;</button>
        `;

        toast.querySelector('.toast-close').addEventListener('click', () => removeToast(toast));
        container.appendChild(toast);

        setTimeout(() => removeToast(toast), 4000);
    }

    function removeToast(toast) {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    }

    // ─── Modal Management ──────────────────────────────────────────

    function openModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    function closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    function closeAllModals() {
        document.querySelectorAll('.modal-overlay.active').forEach(m => {
            m.classList.remove('active');
        });
        document.body.style.overflow = '';
    }

    // ─── Render Sidebar ────────────────────────────────────────────

    function renderSidebar() {
        if (!App.state.vault) return;

        const entries = App.state.vault.entries || [];
        const active = entries.filter(e => !e.trashed);
        const trashed = entries.filter(e => e.trashed);
        const favorites = active.filter(e => e.favorite);

        // Update counts
        setText('count-all', active.length);
        setText('count-favorites', favorites.length);
        setText('count-trash', trashed.length);

        const categories = ['passwords', 'apikeys', 'bank', 'cards', 'notes', 'identities', 'licenses', 'sshkeys', 'recovery'];
        categories.forEach(cat => {
            const el = document.getElementById(`count-${cat}`);
            if (el) el.textContent = active.filter(e => e.category === cat).length;
        });

        // Render tags
        const tagsList = document.getElementById('tags-list');
        if (tagsList) {
            const tags = Search.getAllTags(active);
            tagsList.innerHTML = tags.map(tag => `
                <div class="nav-item" data-view="tag:${tag}">
                    <span class="icon">🏷️</span>
                    <span>${tag}</span>
                </div>
            `).join('');
        }

        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === App.state.currentView);
        });
    }

    // ─── Render Entries ────────────────────────────────────────────

    function renderEntries() {
        if (!App.state.vault) return;

        const container = document.getElementById('entries-container');
        if (!container) return;

        let entries = App.state.vault.entries.filter(e => !e.trashed);
        const view = App.state.currentView;

        // Filter by category/tag
        if (view === 'favorites') {
            entries = entries.filter(e => e.favorite);
        } else if (view === 'trash') {
            entries = App.state.vault.entries.filter(e => e.trashed);
        } else if (view.startsWith('tag:')) {
            const tag = view.substring(4);
            entries = entries.filter(e => (e.tags || []).includes(tag));
        } else if (view !== 'all') {
            entries = entries.filter(e => e.category === view);
        }

        // Search filter
        if (App.state.searchQuery) {
            Search.buildIndex(entries);
            const matchingIds = Search.fuzzySearch(App.state.searchQuery);
            if (matchingIds) {
                entries = entries.filter(e => matchingIds.includes(e.id));
            }
        }

        // Sort: favorites first, then by updatedAt desc
        entries = Search.sortEntries(entries);

        // Update content title
        const titleEl = document.getElementById('content-title');
        if (titleEl) {
            if (view === 'all') titleEl.textContent = 'All Items';
            else if (view === 'favorites') titleEl.textContent = 'Favorites';
            else if (view === 'trash') titleEl.textContent = 'Trash';
            else if (view.startsWith('tag:')) titleEl.textContent = `Tag: ${view.substring(4)}`;
            else titleEl.textContent = CATEGORY_LABELS[view] || view;
        }

        // Update count
        setText('entry-count', `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`);

        // Render
        if (entries.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔐</div>
                    <h3>No entries found</h3>
                    <p>${App.state.searchQuery ? 'Try a different search term.' : 'Click "Add New" to get started.'}</p>
                    ${!App.state.searchQuery ? '<button class="btn btn-primary" onclick="App.openAddModal()">+ Add Entry</button>' : ''}
                </div>
            `;
            return;
        }

        const viewMode = App.state.vault.settings?.viewMode || 'grid';
        container.className = viewMode === 'list' ? 'entries-list' : 'entries-grid';

        container.innerHTML = entries.map(entry => {
            const icon = CATEGORY_ICONS[entry.category] || '📌';
            const subtitle = getEntrySubtitle(entry);
            const updated = new Date(entry.updatedAt).toLocaleDateString();

            return `
                <div class="entry-card" data-id="${entry.id}">
                    <div class="entry-card-header">
                        <div class="entry-card-icon">${icon}</div>
                        <div class="entry-card-info">
                            <div class="entry-card-title">${escapeHtml(entry.title)}</div>
                            <div class="entry-card-subtitle">${escapeHtml(subtitle)}</div>
                        </div>
                        <div class="entry-card-actions">
                            <button class="entry-card-fav ${entry.favorite ? 'active' : ''}"
                                    data-fav-id="${entry.id}" title="Toggle favorite">
                                ${entry.favorite ? '⭐' : '☆'}
                            </button>
                        </div>
                    </div>
                    <div class="entry-card-meta">
                        <span>${CATEGORY_LABELS[entry.category] || entry.category}</span>
                        <span>${updated}</span>
                    </div>
                    ${entry.tags && entry.tags.length > 0 ? `
                        <div class="entry-card-tags">
                            ${entry.tags.slice(0, 3).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
                            ${entry.tags.length > 3 ? `<span class="tag">+${entry.tags.length - 3}</span>` : ''}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    function getEntrySubtitle(entry) {
        switch (entry.category) {
            case 'passwords': return entry.username || entry.url || 'No username';
            case 'apikeys': return entry.service || 'No service';
            case 'bank': return entry.bankName || 'No bank name';
            case 'cards': return entry.cardNumber ? `****${entry.cardNumber.slice(-4)}` : 'No card number';
            case 'notes': return (entry.content || '').substring(0, 50);
            case 'identities': return entry.fullName || entry.email || 'No name';
            case 'licenses': return entry.product || 'No product';
            case 'sshkeys': return entry.host || 'No host';
            case 'recovery': return entry.service || 'No service';
            case 'custom': return `${(entry.fields || []).length} fields`;
            default: return '';
        }
    }

    // ─── Render Stats ──────────────────────────────────────────────

    function renderStats() {
        if (!App.state.vault) return;

        const entries = App.state.vault.entries.filter(e => !e.trashed);
        const cats = new Set(entries.map(e => e.category));

        setText('stat-total', entries.length);
        setText('stat-favorites', entries.filter(e => e.favorite).length);
        setText('stat-categories', cats.size);

        const lastBackup = App.state.vault.settings?.lastBackup;
        setText('stat-last-backup', lastBackup ? new Date(lastBackup).toLocaleDateString() : 'Never');
    }

    // ─── Entry Detail Modal ────────────────────────────────────────

    function showEntryDetail(id) {
        const entry = App.state.vault.entries.find(e => e.id === id);
        if (!entry) return;

        App.state.selectedEntryId = id;

        document.getElementById('detail-title').textContent = entry.title;
        const body = document.getElementById('detail-body');

        let html = '';

        // Category
        html += `<div class="detail-field">
            <div class="detail-field-label">Category</div>
            <div class="detail-field-value">
                <span>${CATEGORY_ICONS[entry.category] || ''} ${CATEGORY_LABELS[entry.category] || entry.category}</span>
            </div>
        </div>`;

        // Dynamic fields based on category
        const fields = getDetailFields(entry);
        fields.forEach(field => {
            const isSensitive = field.sensitive;
            const value = entry[field.key] || '';

            html += `
                <div class="detail-field">
                    <div class="detail-field-label">${field.label}</div>
                    <div class="detail-field-value">
                        <span class="value-text ${isSensitive ? 'masked' : ''}" id="detail-val-${field.key}">
                            ${isSensitive ? '••••••••' : escapeHtml(value)}
                        </span>
                        <div class="detail-field-actions">
                            ${value ? `
                                <button data-copy="${escapeHtml(value)}" data-field="${field.label}" title="Copy">📋</button>
                                ${isSensitive ? `<button data-toggle="${field.key}" data-real="${escapeHtml(value)}" title="Show/Hide">👁️</button>` : ''}
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        });

        // Tags
        if (entry.tags && entry.tags.length > 0) {
            html += `
                <div class="detail-field">
                    <div class="detail-field-label">Tags</div>
                    <div class="entry-card-tags" style="padding:8px 0;">
                        ${entry.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
                    </div>
                </div>
            `;
        }

        // Metadata
        html += `
            <div class="detail-field">
                <div class="detail-field-label">Created</div>
                <div class="detail-field-value">
                    <span class="value-text">${new Date(entry.createdAt).toLocaleString()}</span>
                </div>
            </div>
            <div class="detail-field">
                <div class="detail-field-label">Last Modified</div>
                <div class="detail-field-value">
                    <span class="value-text">${new Date(entry.updatedAt).toLocaleString()}</span>
                </div>
            </div>
        `;

        body.innerHTML = html;

        // Attach copy/toggle handlers
        body.querySelectorAll('[data-copy]').forEach(btn => {
            btn.addEventListener('click', () => {
                Session.copyToClipboard(btn.dataset.copy, btn.dataset.field);
            });
        });

        body.querySelectorAll('[data-toggle]').forEach(btn => {
            btn.addEventListener('click', () => {
                const el = document.getElementById(`detail-val-${btn.dataset.toggle}`);
                if (el.classList.contains('masked')) {
                    el.textContent = btn.dataset.real;
                    el.classList.remove('masked');
                } else {
                    el.textContent = '••••••••';
                    el.classList.add('masked');
                }
            });
        });

        openModal('detail-modal');
    }

    function getDetailFields(entry) {
        const common = [];
        switch (entry.category) {
            case 'passwords':
                common.push(
                    { key: 'username', label: 'Username' },
                    { key: 'password', label: 'Password', sensitive: true },
                    { key: 'url', label: 'URL' },
                    { key: 'totpSecret', label: 'TOTP Secret', sensitive: true }
                );
                break;
            case 'apikeys':
                common.push(
                    { key: 'service', label: 'Service' },
                    { key: 'apiKey', label: 'API Key', sensitive: true },
                    { key: 'endpoint', label: 'Endpoint' }
                );
                break;
            case 'bank':
                common.push(
                    { key: 'bankName', label: 'Bank Name' },
                    { key: 'accountNumber', label: 'Account Number', sensitive: true },
                    { key: 'routingNumber', label: 'Routing Number', sensitive: true },
                    { key: 'iban', label: 'IBAN', sensitive: true },
                    { key: 'swift', label: 'SWIFT/BIC' }
                );
                break;
            case 'cards':
                common.push(
                    { key: 'cardType', label: 'Card Type' },
                    { key: 'cardHolder', label: 'Card Holder' },
                    { key: 'cardNumber', label: 'Card Number', sensitive: true },
                    { key: 'cardExpiry', label: 'Expiry Date' },
                    { key: 'cvv', label: 'CVV', sensitive: true }
                );
                break;
            case 'notes':
                common.push({ key: 'content', label: 'Content' });
                break;
            case 'identities':
                common.push(
                    { key: 'fullName', label: 'Full Name' },
                    { key: 'email', label: 'Email' },
                    { key: 'phone', label: 'Phone' },
                    { key: 'address', label: 'Address' },
                    { key: 'dateOfBirth', label: 'Date of Birth' }
                );
                break;
            case 'licenses':
                common.push(
                    { key: 'product', label: 'Product' },
                    { key: 'licenseKey', label: 'License Key', sensitive: true },
                    { key: 'purchaseDate', label: 'Purchase Date' },
                    { key: 'expiryDate', label: 'Expiry Date' }
                );
                break;
            case 'sshkeys':
                common.push(
                    { key: 'host', label: 'Host' },
                    { key: 'publicKey', label: 'Public Key' },
                    { key: 'privateKey', label: 'Private Key', sensitive: true },
                    { key: 'passphrase', label: 'Passphrase', sensitive: true }
                );
                break;
            case 'recovery':
                common.push(
                    { key: 'service', label: 'Service' },
                    { key: 'codes', label: 'Recovery Codes', sensitive: true }
                );
                break;
            case 'custom':
                if (entry.fields) {
                    entry.fields.forEach(f => {
                        common.push({ key: `fields_${f.name}`, label: f.name, sensitive: f.sensitive });
                    });
                }
                break;
        }
        if (entry.notes) {
            common.push({ key: 'notes', label: 'Notes' });
        }
        return common;
    }

    // ─── Edit Modal ────────────────────────────────────────────────

    function openEditModal(entry = null) {
        currentEditId = entry ? entry.id : null;
        currentEditCategory = entry ? entry.category : 'passwords';

        document.getElementById('edit-title').textContent = entry ? 'Edit Entry' : 'Add Entry';

        // Set category selector
        document.querySelectorAll('.category-option').forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.category === currentEditCategory);
        });

        // Set common fields
        document.getElementById('entry-title').value = entry?.title || '';
        document.getElementById('entry-tags').value = (entry?.tags || []).join(', ');
        document.getElementById('entry-favorite').checked = entry?.favorite || false;

        // Render dynamic fields
        renderDynamicFields(currentEditCategory, entry);

        openModal('edit-modal');
    }

    function renderDynamicFields(category, entry = null) {
        currentEditCategory = category;
        const container = document.getElementById('dynamic-fields');
        const fields = getEditFields(category);

        let html = '';
        fields.forEach(field => {
            const value = entry?.[field.key] || '';

            if (field.type === 'password') {
                html += `
                    <div class="form-group">
                        <label for="ef-${field.key}">${field.label}</label>
                        <div class="password-input-group">
                            <input type="password" id="ef-${field.key}" value="${escapeHtml(value)}" placeholder="${field.placeholder || ''}">
                            <div class="password-input-actions">
                                <button type="button" data-toggle-pw="ef-${field.key}">👁️</button>
                                <button type="button" data-generate="ef-${field.key}">🎲</button>
                            </div>
                        </div>
                        <div class="strength-bar" id="pw-strength-${field.key}" style="display:${value ? 'block' : 'none'}">
                            <div class="strength-segments" id="pw-segments-${field.key}"></div>
                            <span class="strength-label" id="pw-label-${field.key}"></span>
                        </div>
                        <div class="password-generator hidden" id="generator-${field.key}">
                            <div class="generator-preview" id="gen-preview-${field.key}"></div>
                            <div class="generator-controls">
                                <div class="generator-slider">
                                    <label>Length:</label>
                                    <input type="range" id="gen-length-${field.key}" min="8" max="64" value="16">
                                    <span class="slider-value" id="gen-length-val-${field.key}">16</span>
                                </div>
                                <div class="generator-options">
                                    <label><input type="checkbox" id="gen-upper-${field.key}" checked> A-Z</label>
                                    <label><input type="checkbox" id="gen-lower-${field.key}" checked> a-z</label>
                                    <label><input type="checkbox" id="gen-num-${field.key}" checked> 0-9</label>
                                    <label><input type="checkbox" id="gen-sym-${field.key}" checked> !@#</label>
                                </div>
                                <div class="generator-modes">
                                    <button type="button" class="active" data-gen-mode="password" data-target="${field.key}">Password</button>
                                    <button type="button" data-gen-mode="passphrase" data-target="${field.key}">Passphrase</button>
                                    <button type="button" data-gen-mode="pin" data-target="${field.key}">PIN</button>
                                </div>
                                <button type="button" class="btn btn-primary btn-sm btn-full" data-use-generated="${field.key}">Use This Password</button>
                            </div>
                        </div>
                    </div>
                `;
            } else if (field.type === 'textarea') {
                html += `
                    <div class="form-group">
                        <label for="ef-${field.key}">${field.label}</label>
                        <textarea id="ef-${field.key}" placeholder="${field.placeholder || ''}">${escapeHtml(value)}</textarea>
                    </div>
                `;
            } else {
                html += `
                    <div class="form-group">
                        <label for="ef-${field.key}">${field.label}</label>
                        <input type="${field.type || 'text'}" id="ef-${field.key}" value="${escapeHtml(value)}" placeholder="${field.placeholder || ''}">
                    </div>
                `;
            }
        });

        container.innerHTML = html;
        attachFieldListeners(category);
    }

    function getEditFields(category) {
        switch (category) {
            case 'passwords':
                return [
                    { key: 'username', label: 'Username / Email', placeholder: 'user@example.com' },
                    { key: 'password', label: 'Password', type: 'password', placeholder: 'Enter or generate password' },
                    { key: 'url', label: 'Website URL', placeholder: 'https://example.com' },
                    { key: 'totpSecret', label: 'TOTP Secret (optional)', placeholder: 'Base32 secret for 2FA' }
                ];
            case 'apikeys':
                return [
                    { key: 'service', label: 'Service Name', placeholder: 'e.g., AWS, GitHub' },
                    { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Enter API key' },
                    { key: 'endpoint', label: 'Endpoint URL', placeholder: 'https://api.example.com' }
                ];
            case 'bank':
                return [
                    { key: 'bankName', label: 'Bank Name' },
                    { key: 'accountNumber', label: 'Account Number', type: 'password' },
                    { key: 'routingNumber', label: 'Routing Number', type: 'password' },
                    { key: 'iban', label: 'IBAN', type: 'password' },
                    { key: 'swift', label: 'SWIFT/BIC' }
                ];
            case 'cards':
                return [
                    { key: 'cardType', label: 'Card Type', placeholder: 'Visa, Mastercard, etc.' },
                    { key: 'cardHolder', label: 'Card Holder Name' },
                    { key: 'cardNumber', label: 'Card Number', type: 'password' },
                    { key: 'cardExpiry', label: 'Expiry (MM/YY)', placeholder: '12/25' },
                    { key: 'cvv', label: 'CVV', type: 'password' }
                ];
            case 'notes':
                return [
                    { key: 'content', label: 'Content', type: 'textarea', placeholder: 'Your secure note...' }
                ];
            case 'identities':
                return [
                    { key: 'fullName', label: 'Full Name' },
                    { key: 'email', label: 'Email', type: 'email' },
                    { key: 'phone', label: 'Phone', type: 'tel' },
                    { key: 'address', label: 'Address', type: 'textarea' },
                    { key: 'dateOfBirth', label: 'Date of Birth', type: 'date' }
                ];
            case 'licenses':
                return [
                    { key: 'product', label: 'Product Name' },
                    { key: 'licenseKey', label: 'License Key', type: 'password' },
                    { key: 'purchaseDate', label: 'Purchase Date', type: 'date' },
                    { key: 'expiryDate', label: 'Expiry Date', type: 'date' }
                ];
            case 'sshkeys':
                return [
                    { key: 'host', label: 'Host', placeholder: 'github.com, server.example.com' },
                    { key: 'publicKey', label: 'Public Key', type: 'textarea' },
                    { key: 'privateKey', label: 'Private Key', type: 'password' },
                    { key: 'passphrase', label: 'Passphrase', type: 'password' }
                ];
            case 'recovery':
                return [
                    { key: 'service', label: 'Service Name' },
                    { key: 'codes', label: 'Recovery Codes', type: 'textarea', placeholder: 'One code per line' }
                ];
            case 'custom':
                return [
                    { key: 'customData', label: 'Data (JSON)', type: 'textarea', placeholder: '{"key": "value"}' }
                ];
            default:
                return [];
        }
    }

    function attachFieldListeners(category) {
        // Password toggle
        document.querySelectorAll('[data-toggle-pw]').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = document.getElementById(btn.dataset.togglePw);
                if (input) input.type = input.type === 'password' ? 'text' : 'password';
            });
        });

        // Generator toggle
        document.querySelectorAll('[data-generate]').forEach(btn => {
            btn.addEventListener('click', () => {
                const gen = document.getElementById(`generator-${btn.dataset.generate.replace('ef-', '')}`);
                if (gen) gen.classList.toggle('hidden');
            });
        });

        // Generator controls
        const keys = ['password', 'apiKey', 'licenseKey', 'privateKey', 'cvv', 'cardNumber', 'accountNumber', 'routingNumber', 'iban', 'passphrase'];
        keys.forEach(key => {
            const lengthSlider = document.getElementById(`gen-length-${key}`);
            const lengthVal = document.getElementById(`gen-length-val-${key}`);
            const preview = document.getElementById(`gen-preview-${key}`);

            if (lengthSlider && lengthVal) {
                lengthSlider.addEventListener('input', () => {
                    lengthVal.textContent = lengthSlider.value;
                    generatePreview(key);
                });
            }

            // Checkbox changes
            ['upper', 'lower', 'num', 'sym'].forEach(opt => {
                const cb = document.getElementById(`gen-${opt}-${key}`);
                if (cb) cb.addEventListener('change', () => generatePreview(key));
            });

            // Mode buttons
            document.querySelectorAll(`[data-target="${key}"]`).forEach(btn => {
                btn.addEventListener('click', (e) => {
                    document.querySelectorAll(`[data-target="${key}"]`).forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    generatePreview(key);
                });
            });

            // Use generated
            const useBtn = document.querySelector(`[data-use-generated="${key}"]`);
            if (useBtn) {
                useBtn.addEventListener('click', () => {
                    const input = document.getElementById(`ef-${key}`);
                    if (input && preview) {
                        input.value = preview.textContent;
                        input.type = 'text';
                        updateStrength(key, input.value);
                    }
                });
            }
        });

        // Strength indicator on password input
        const pwInput = document.getElementById('ef-password');
        if (pwInput) {
            pwInput.addEventListener('input', () => updateStrength('password', pwInput.value));
        }

        // Initial preview
        if (category === 'passwords') generatePreview('password');
    }

    function generatePreview(key) {
        const preview = document.getElementById(`gen-preview-${key}`);
        if (!preview) return;

        const modeBtn = document.querySelector(`[data-target="${key}"].active`);
        const mode = modeBtn?.dataset.genMode || 'password';

        let generated;
        if (mode === 'passphrase') {
            generated = PasswordGenerator.generatePassphrase(4);
        } else if (mode === 'pin') {
            const length = parseInt(document.getElementById(`gen-length-${key}`)?.value || 6);
            generated = PasswordGenerator.generatePIN(length);
        } else {
            const length = parseInt(document.getElementById(`gen-length-${key}`)?.value || 16);
            generated = PasswordGenerator.generatePassword(length, {
                uppercase: document.getElementById(`gen-upper-${key}`)?.checked !== false,
                lowercase: document.getElementById(`gen-lower-${key}`)?.checked !== false,
                numbers: document.getElementById(`gen-num-${key}`)?.checked !== false,
                symbols: document.getElementById(`gen-sym-${key}`)?.checked !== false
            });
        }

        preview.textContent = generated;
    }

    function updateStrength(key, password) {
        const bar = document.getElementById(`pw-strength-${key}`);
        const segments = document.getElementById(`pw-segments-${key}`);
        const label = document.getElementById(`pw-label-${key}`);

        if (!bar || !segments || !label) return;

        if (!password) {
            bar.style.display = 'none';
            return;
        }

        bar.style.display = 'block';
        const strength = PasswordGenerator.evaluateStrength(password);

        segments.innerHTML = '';
        for (let i = 0; i < 4; i++) {
            const seg = document.createElement('div');
            seg.className = 'strength-segment';
            if (i <= strength.score) {
                seg.style.background = strength.color;
            }
            segments.appendChild(seg);
        }

        label.textContent = strength.label;
        label.style.color = strength.color;
    }

    // ─── Collect Edit Form Data ────────────────────────────────────

    function collectEditData() {
        const title = document.getElementById('entry-title').value.trim();
        if (!title) {
            showToast('Title is required', 'error');
            return null;
        }

        const data = {
            category: currentEditCategory,
            title: title,
            tags: document.getElementById('entry-tags').value.split(',').map(t => t.trim()).filter(Boolean),
            favorite: document.getElementById('entry-favorite').checked
        };

        // Collect dynamic fields
        const fields = getEditFields(currentEditCategory);
        fields.forEach(field => {
            const input = document.getElementById(`ef-${field.key}`);
            if (input) {
                data[field.key] = input.value;
            }
        });

        // Handle custom fields
        if (currentEditCategory === 'custom') {
            try {
                const customData = data.customData;
                data.fields = customData ? JSON.parse(customData) : [];
                delete data.customData;
            } catch {
                data.fields = [];
            }
        }

        return data;
    }

    // ─── Password Health Dashboard ─────────────────────────────────

    function showHealthDashboard() {
        if (!App.state.vault) return;

        const body = document.getElementById('health-body');
        const passwords = App.state.vault.entries.filter(e => !e.trashed && e.category === 'passwords' && e.password);

        const weak = [];
        const reused = [];
        const old = [];
        const noPassword = App.state.vault.entries.filter(e => !e.trashed && e.category === 'passwords' && !e.password);

        const passwordCounts = {};

        passwords.forEach(entry => {
            const strength = PasswordGenerator.evaluateStrength(entry.password);
            if (strength.score < 2) weak.push(entry);

            passwordCounts[entry.password] = passwordCounts[entry.password] || [];
            passwordCounts[entry.password].push(entry);

            const age = (Date.now() - new Date(entry.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
            if (age > 90) old.push(entry);
        });

        Object.values(passwordCounts).forEach(group => {
            if (group.length > 1) reused.push(...group);
        });

        body.innerHTML = `
            <div class="health-grid">
                <div class="health-card ${weak.length > 0 ? 'danger' : 'success'}">
                    <div class="health-icon">⚠️</div>
                    <div class="health-count">${weak.length}</div>
                    <div class="health-label">Weak Passwords</div>
                </div>
                <div class="health-card ${reused.length > 0 ? 'warning' : 'success'}">
                    <div class="health-icon">🔄</div>
                    <div class="health-count">${reused.length}</div>
                    <div class="health-label">Reused Passwords</div>
                </div>
                <div class="health-card ${old.length > 0 ? 'warning' : 'success'}">
                    <div class="health-icon">📅</div>
                    <div class="health-count">${old.length}</div>
                    <div class="health-label">Old Passwords (90+ days)</div>
                </div>
                <div class="health-card ${noPassword.length > 0 ? 'warning' : 'success'}">
                    <div class="health-icon">🚫</div>
                    <div class="health-count">${noPassword.length}</div>
                    <div class="health-label">Missing Passwords</div>
                </div>
            </div>
            ${weak.length > 0 ? `
                <h4 style="margin-bottom:8px;">Weak Passwords</h4>
                <div style="margin-bottom:16px;">
                    ${weak.map(e => `<div style="padding:6px 0;color:var(--text-secondary);font-size:0.9rem;">• ${escapeHtml(e.title)}</div>`).join('')}
                </div>
            ` : ''}
            ${reused.length > 0 ? `
                <h4 style="margin-bottom:8px;">Reused Passwords</h4>
                <div style="margin-bottom:16px;">
                    ${[...new Set(reused.map(e => e.id))].map(id => {
                        const e = App.state.vault.entries.find(x => x.id === id);
                        return `<div style="padding:6px 0;color:var(--text-secondary);font-size:0.9rem;">• ${escapeHtml(e.title)}</div>`;
                    }).join('')}
                </div>
            ` : ''}
        `;

        openModal('health-modal');
    }

    // ─── Audit Log Viewer ──────────────────────────────────────────

    function renderAuditLog() {
        const viewer = document.getElementById('audit-log-viewer');
        if (!viewer) return;

        const log = Audit.getLog();
        if (log.length === 0) {
            viewer.innerHTML = '<p style="color:var(--text-muted);text-align:center;">No entries yet.</p>';
            return;
        }

        viewer.innerHTML = [...log].reverse().map(entry => `
            <div class="audit-entry">
                <span class="audit-time">${new Date(entry.timestamp).toLocaleString()}</span>
                <span class="audit-action">${entry.action}</span>
                <span class="audit-detail">${escapeHtml(entry.detail)}</span>
            </div>
        `).join('');
    }

    // ─── Helpers ───────────────────────────────────────────────────

    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ─── Public API ────────────────────────────────────────────────

    return {
        showToast,
        openModal,
        closeModal,
        closeAllModals,
        renderSidebar,
        renderEntries,
        renderStats,
        showEntryDetail,
        openEditModal,
        collectEditData,
        showHealthDashboard,
        renderAuditLog,
        CATEGORY_ICONS,
        CATEGORY_LABELS,
        escapeHtml,
        getCurrentEditId: () => currentEditId,
        getCurrentEditCategory: () => currentEditCategory
    };
})();
