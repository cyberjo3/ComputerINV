// ================= AUTHENTICATION & LOCK SYSTEM =================
const APP_PASSCODE = "admin1234";

function checkAuthStatus() {
    const isAuthenticated = sessionStorage.getItem('it_inv_auth') === 'true';
    const overlay = document.getElementById('authOverlay');
    const input = document.getElementById('passcodeInput');

    if (isAuthenticated) {
        if (overlay) overlay.classList.add('hidden');
    } else {
        if (overlay) overlay.classList.remove('hidden');
        if (input) {
            input.value = '';
            setTimeout(() => input.focus(), 100);
        }
    }
}

function handleAuthSubmit(event) {
    event.preventDefault();
    const input = document.getElementById('passcodeInput');
    const errorMsg = document.getElementById('authErrorMsg');
    const enteredPasscode = input.value.trim();

    if (enteredPasscode === APP_PASSCODE) {
        sessionStorage.setItem('it_inv_auth', 'true');
        document.getElementById('authOverlay').classList.add('hidden');
        if (errorMsg) errorMsg.classList.add('hidden');
        input.value = '';
        
        if (typeof addAuditLog === 'function') {
            addAuditLog('SECURITY', 'SYSTEM', 'Session authenticated via Passcode');
        }
    } else {
        if (errorMsg) errorMsg.classList.remove('hidden');
        input.classList.add('border-rose-400', 'bg-rose-50');
        input.value = '';
        input.focus();
        setTimeout(() => {
            input.classList.remove('border-rose-400', 'bg-rose-50');
        }, 1500);
    }
}

function lockSystem() {
    sessionStorage.removeItem('it_inv_auth');
    checkAuthStatus();
}

// ================= DATA & APPLICATION STATE =================
let db = JSON.parse(localStorage.getItem('it-inventory-db')) || { assets: [], accessories: [], users: [], logs: [] };
if (!db.accessories) db.accessories = [];
if (!db.logs) db.logs = [];

let currentDetailIndex = null;
let currentSecurityFilter = 'ALL';

const DOM = {
    tabsNav: document.getElementById('tabs-nav'),
    viewAssets: document.getElementById('view-assets'),
    viewAssetForm: document.getElementById('view-asset-form'),
    viewAccessories: document.getElementById('view-accessories'),
    viewAccessoryForm: document.getElementById('view-accessory-form'),
    viewUsers: document.getElementById('view-users'),
    viewLogs: document.getElementById('view-logs'),
    assetDetailModal: document.getElementById('assetDetailModal'),
    modalAssetLogs: document.getElementById('modal-asset-logs'),
    
    tabAssets: document.getElementById('tab-assets'),
    tabAccessories: document.getElementById('tab-accessories'),
    tabUsers: document.getElementById('tab-users'),
    tabLogs: document.getElementById('tab-logs'),

    assetFormTitle: document.getElementById('assetFormTitle'),
    assetForm: document.getElementById('addAssetForm'),
    assetTableBody: document.getElementById('assetTableBody'),
    
    total: document.getElementById('stat-total'),
    deployed: document.getElementById('stat-deployed'),
    ready: document.getElementById('stat-ready'),
    statMac: document.getElementById('stat-mac'),
    statWin: document.getElementById('stat-win'),
    statSecCompliant: document.getElementById('stat-sec-compliant'),
    statSecNonCompliant: document.getElementById('stat-sec-noncompliant'),
    secFilterSelect: document.getElementById('secFilterSelect'),

    accessoryFormTitle: document.getElementById('accessoryFormTitle'),
    accessoryForm: document.getElementById('addAccessoryForm'),
    accessoryTableBody: document.getElementById('accessoryTableBody'),

    userFormTitle: document.getElementById('userFormTitle'),
    userForm: document.getElementById('addUserForm'),
    userTableBody: document.getElementById('userTableBody'),
    cancelEditUserBtn: document.getElementById('cancelEditUserBtn'),
    saveUserBtn: document.getElementById('saveUserBtn'),

    logTableBody: document.getElementById('logTableBody'),

    exportBtn: document.getElementById('exportBtn'),
    importBtn: document.getElementById('importBtn')
};

// ================= Logger Helper =================
function addAuditLog(category, target, details) {
    if (!db.logs) db.logs = [];
    const logEntry = {
        id: 'LOG-' + Date.now(),
        timestamp: new Date().toISOString(),
        category: category,
        target: target,
        details: details
    };
    db.logs.unshift(logEntry);
    if (db.logs.length > 300) {
        db.logs = db.logs.slice(0, 300);
    }
}

// ================= Tab Switching Logic =================
window.switchTab = (tabName) => {
    DOM.viewAssetForm.classList.add('hidden');
    DOM.viewAccessoryForm.classList.add('hidden');
    closeDetailModal();
    
    const inactiveClass = "py-3.5 border-b-2 border-transparent text-gray-500 hover:text-[#0b1f3a] font-semibold focus:outline-none transition-colors whitespace-nowrap text-sm";
    const activeClass = "py-3.5 border-b-2 border-[#0b1f3a] text-[#0b1f3a] font-bold focus:outline-none transition-colors whitespace-nowrap text-sm";

    DOM.tabAssets.className = inactiveClass;
    DOM.tabAccessories.className = inactiveClass;
    DOM.tabUsers.className = inactiveClass;
    DOM.tabLogs.className = inactiveClass;
    
    DOM.viewAssets.classList.add('hidden');
    DOM.viewAccessories.classList.add('hidden');
    DOM.viewUsers.classList.add('hidden');
    DOM.viewLogs.classList.add('hidden');

    if (tabName === 'assets') {
        DOM.viewAssets.classList.remove('hidden');
        DOM.tabAssets.className = activeClass;
    } else if (tabName === 'accessories') {
        DOM.viewAccessories.classList.remove('hidden');
        DOM.tabAccessories.className = activeClass;
    } else if (tabName === 'users') {
        DOM.viewUsers.classList.remove('hidden');
        DOM.tabUsers.className = activeClass;
    } else if (tabName === 'logs') {
        DOM.viewLogs.classList.remove('hidden');
        DOM.tabLogs.className = activeClass;
        renderLogsTable();
    }
};

// ================= Core Logic =================
function updateApp() {
    localStorage.setItem('it-inventory-db', JSON.stringify(db));
    renderAssetsTable();
    renderAccessoriesTable();
    renderUsersTable();
    renderLogsTable();
    updateStats();
    
    // Auto-sync ข้อมูลขึ้น GitHub อัตโนมัติทุกครั้งที่มีการอัปเดต
    pushDataToGitHub();
}

// ================= Helpers =================
function populateUserDropdown(selectElementId, selectedValue = "") {
    const selectEl = document.getElementById(selectElementId);
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="">-- Unassigned --</option>';
    db.users.forEach(user => {
        const statusWarning = (user.status === 'Resigned') ? ' ⚠️ (Resigned)' : '';
        const empTypeBadge = user.employmentType ? ` [${user.employmentType}]` : '';
        selectEl.innerHTML += `<option value="${user.empId}">${user.firstName} ${user.lastName} (${user.empId})${empTypeBadge}${statusWarning}</option>`;
    });
    selectEl.value = selectedValue;
}

function getAssignedUserName(empId) {
    let user = db.users.find(u => u.empId === empId);
    if (!user) return '<span class="text-gray-400 italic">Unassigned</span>';
    const isResigned = user.status === 'Resigned';
    return isResigned 
        ? `<span class="text-rose-600 font-medium line-through">${user.firstName} (${empId})</span> <span class="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-semibold">Resigned</span>`
        : `<span class="text-blue-700 font-semibold">${user.firstName} (${empId})</span>`;
}

function getSecurityBadge(sec) {
    if (!sec) {
        return `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">Not Audited</span>`;
    }
    if (sec.isCompliant) {
        return `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800"><i class="fas fa-check-circle mr-1 text-emerald-600"></i>Compliant</span>`;
    }
    return `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800"><i class="fas fa-exclamation-triangle mr-1 text-rose-600"></i>Non-Compliant</span>`;
}

// ================= Assets (Computers) =================
window.showAssetForm = (editIndex = null) => {
    DOM.viewAssets.classList.add('hidden');
    DOM.viewAssetForm.classList.remove('hidden');
    DOM.tabsNav.classList.add('hidden');

    if (editIndex !== null) {
        DOM.assetFormTitle.innerText = "Edit Computer";
        document.getElementById('editAssetIndex').value = editIndex;
        const asset = db.assets[editIndex];
        document.getElementById('assetTag').value = asset.tag || "";
        document.getElementById('assetType').value = asset.type || "";
        document.getElementById('assetOS').value = asset.os || "";
        document.getElementById('assetModel').value = asset.model || "";
        document.getElementById('assetSerial').value = asset.serial || "";
        document.getElementById('assetCpu').value = asset.cpu || "";
        document.getElementById('assetRam').value = asset.ram || "";
        document.getElementById('assetStorage').value = asset.storage || "";
        document.getElementById('assetMac').value = asset.mac || "";
        document.getElementById('assetIp').value = asset.ip || "";
        document.getElementById('assetStatus').value = asset.status || "Ready to Deploy";
        populateUserDropdown('assetAssignedTo', asset.assignedTo || "");
        document.getElementById('assetPurchaseDate').value = asset.purchaseDate || "";
        document.getElementById('assetWarrantyDate').value = asset.warrantyDate || "";
        document.getElementById('assetNotes').value = asset.notes || "";
    } else {
        DOM.assetFormTitle.innerText = "Add Computer";
        document.getElementById('editAssetIndex').value = "";
        DOM.assetForm.reset();
        populateUserDropdown('assetAssignedTo', "");
    }
};

window.hideAssetForm = () => {
    DOM.viewAssetForm.classList.add('hidden');
    DOM.viewAssets.classList.remove('hidden');
    DOM.tabsNav.classList.remove('hidden');
};

window.applySecurityFilter = () => {
    if (DOM.secFilterSelect) {
        currentSecurityFilter = DOM.secFilterSelect.value;
    }
    renderAssetsTable();
};

function renderAssetsTable() {
    DOM.assetTableBody.innerHTML = '';
    
    const filteredAssets = db.assets.map((asset, originalIndex) => ({ asset, originalIndex })).filter(({ asset }) => {
        if (currentSecurityFilter === 'COMPLIANT') {
            return asset.security && asset.security.isCompliant === true;
        } else if (currentSecurityFilter === 'NON_COMPLIANT') {
            return asset.security && asset.security.isCompliant === false;
        } else if (currentSecurityFilter === 'NOT_AUDITED') {
            return !asset.security;
        }
        return true;
    });

    if (filteredAssets.length === 0) {
        DOM.assetTableBody.innerHTML = `
            <tr>
                <td colspan="9" class="py-8 text-center text-sm text-gray-400">
                    No computers found matching the current filter.
                </td>
            </tr>
        `;
        return;
    }

    filteredAssets.forEach(({ asset, originalIndex }) => {
        let statusColor = asset.status === 'Deployed' ? 'bg-emerald-100 text-emerald-800' : 
                          asset.status === 'Ready to Deploy' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800';
        
        DOM.assetTableBody.innerHTML += `
            <tr class="hover:bg-blue-50/50 transition cursor-pointer" ondblclick="openDetailModal(${originalIndex})" title="Double-click to view specs & security">
                <td class="py-3 px-4 font-mono text-sm font-semibold text-[#0b1f3a]">${asset.tag}</td>
                <td class="py-3 px-4 text-sm text-gray-600">${asset.type || '-'}</td>
                <td class="py-3 px-4 text-sm text-gray-600">${asset.os || '-'}</td>
                <td class="py-3 px-4 font-medium text-slate-800">${asset.model}</td>
                <td class="py-3 px-4 font-mono text-sm text-gray-500">${asset.serial}</td>
                <td class="py-3 px-4"><span class="px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColor}">${asset.status}</span></td>
                <td class="py-3 px-4 text-sm">${getAssignedUserName(asset.assignedTo)}</td>
                <td class="py-3 px-4">${getSecurityBadge(asset.security)}</td>
                <td class="py-3 px-4 text-center space-x-2" onclick="event.stopPropagation()">
                    <button onclick="showAssetForm(${originalIndex})" class="text-blue-600 hover:text-blue-800" title="Edit"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteAsset(${originalIndex})" class="text-rose-500 hover:text-rose-700" title="Delete"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

function updateStats() {
    DOM.total.innerText = db.assets.length;
    DOM.deployed.innerText = db.assets.filter(a => a.status === 'Deployed').length;
    DOM.ready.innerText = db.assets.filter(a => a.status === 'Ready to Deploy').length;
    DOM.statMac.innerText = db.assets.filter(a => a.os === 'macOS').length;
    DOM.statWin.innerText = db.assets.filter(a => a.os === 'Windows').length;

    const compliantCount = db.assets.filter(a => a.security && a.security.isCompliant).length;
    const nonCompliantCount = db.assets.filter(a => a.security && a.security.isCompliant === false).length;

    if (DOM.statSecCompliant) DOM.statSecCompliant.innerText = compliantCount;
    if (DOM.statSecNonCompliant) DOM.statSecNonCompliant.innerText = nonCompliantCount;
}

DOM.assetForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const editIndex = document.getElementById('editAssetIndex').value;
    const existingSecurity = (editIndex !== "" && db.assets[editIndex]) ? db.assets[editIndex].security : null;
    const existingAuditHistory = (editIndex !== "" && db.assets[editIndex]) ? (db.assets[editIndex].auditHistory || []) : [];

    const assetData = {
        tag: document.getElementById('assetTag').value.trim(),
        type: document.getElementById('assetType').value,
        os: document.getElementById('assetOS').value,
        model: document.getElementById('assetModel').value.trim(),
        serial: document.getElementById('assetSerial').value.trim(),
        cpu: document.getElementById('assetCpu').value.trim(),
        ram: document.getElementById('assetRam').value.trim(),
        storage: document.getElementById('assetStorage').value.trim(),
        mac: document.getElementById('assetMac').value.trim(),
        ip: document.getElementById('assetIp').value.trim(),
        status: document.getElementById('assetStatus').value,
        assignedTo: document.getElementById('assetAssignedTo').value,
        purchaseDate: document.getElementById('assetPurchaseDate').value,
        warrantyDate: document.getElementById('assetWarrantyDate').value,
        notes: document.getElementById('assetNotes').value.trim(),
        security: existingSecurity,
        auditHistory: existingAuditHistory
    };
    
    if (editIndex === "") {
        db.assets.push(assetData);
        addAuditLog('ASSET_MGMT', assetData.tag, `Added computer: ${assetData.model} (${assetData.serial})`);
    } else {
        db.assets[editIndex] = assetData;
        addAuditLog('ASSET_MGMT', assetData.tag, `Updated specifications or assignment (Assigned to: ${assetData.assignedTo || 'Unassigned'})`);
    }
    hideAssetForm();
    updateApp();
});

window.deleteAsset = (index) => {
    const a = db.assets[index];
    if(confirm(`Are you sure you want to delete computer ${a.tag} (${a.model})?`)) {
        addAuditLog('ASSET_MGMT', a.tag, `Deleted computer: ${a.model} (S/N: ${a.serial})`);
        db.assets.splice(index, 1);
        updateApp();
    }
};

// ================= Asset Detail Modal & Security Compliance =================
window.openDetailModal = (index) => {
    currentDetailIndex = index;
    const a = db.assets[index];
    if (!a) return;

    document.getElementById('modal-tag').innerText = a.tag;
    document.getElementById('modal-model').innerText = a.model;
    document.getElementById('modal-type').innerText = a.type || '-';
    document.getElementById('modal-os').innerText = a.os || '-';
    document.getElementById('modal-serial').innerText = a.serial || '-';
    
    let statusColor = a.status === 'Deployed' ? 'bg-emerald-100 text-emerald-800' : 
                      a.status === 'Ready to Deploy' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800';
    document.getElementById('modal-status').innerHTML = `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColor}">${a.status}</span>`;
    document.getElementById('modal-assigned').innerHTML = getAssignedUserName(a.assignedTo);
    
    document.getElementById('modal-cpu').innerText = a.cpu || '-';
    document.getElementById('modal-ram').innerText = a.ram || '-';
    document.getElementById('modal-storage').innerText = a.storage || '-';
    document.getElementById('modal-mac').innerText = a.mac || '-';
    document.getElementById('modal-ip').innerText = a.ip || '-';
    document.getElementById('modal-purchase').innerText = a.purchaseDate || '-';
    document.getElementById('modal-warranty').innerText = a.warrantyDate || '-';
    document.getElementById('modal-notes').innerText = a.notes || '-';
    
    const sec = a.security || {};
    document.getElementById('modal-sec-bitlocker').checked = Boolean(sec.diskEncryption);
    document.getElementById('modal-sec-usb').checked = Boolean(sec.usbBlocked);
    document.getElementById('modal-sec-edr').checked = Boolean(sec.edrActive);
    document.getElementById('modal-sec-osbuild').value = sec.osBuild || '';
    document.getElementById('modal-sec-patchdate').value = sec.lastPatchDate || '';

    evaluateModalCompliance();
    renderAssetAuditHistory(a);

    DOM.assetDetailModal.classList.remove('hidden');
};

function renderAssetAuditHistory(asset) {
    if (!DOM.modalAssetLogs) return;
    const history = asset.auditHistory || [];
    if (history.length === 0) {
        DOM.modalAssetLogs.innerHTML = `<span class="text-gray-400 italic">No audit records yet for this device.</span>`;
        return;
    }
    
    DOM.modalAssetLogs.innerHTML = history.slice(0, 10).map(item => {
        const badgeColor = item.isCompliant ? 'text-emerald-700 bg-emerald-100' : 'text-rose-700 bg-rose-100';
        return `
            <div class="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
                <span class="text-gray-500 font-mono text-[11px]">${new Date(item.timestamp).toLocaleString()}</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${badgeColor}">
                    ${item.isCompliant ? 'Compliant' : 'Non-Compliant'}
                </span>
                <span class="text-gray-600 truncate max-w-xs text-[11px]">${item.summary}</span>
            </div>
        `;
    }).join('');
}

window.closeDetailModal = () => {
    if (DOM.assetDetailModal) DOM.assetDetailModal.classList.add('hidden');
    currentDetailIndex = null;
};

window.evaluateModalCompliance = () => {
    const isBitlocker = document.getElementById('modal-sec-bitlocker').checked;
    const isUsb = document.getElementById('modal-sec-usb').checked;
    const isEdr = document.getElementById('modal-sec-edr').checked;
    const patchDate = document.getElementById('modal-sec-patchdate').value;

    let patchOk = false;
    if (patchDate) {
        const days = Math.floor((new Date() - new Date(patchDate)) / (1000 * 60 * 60 * 24));
        if (days <= 60) patchOk = true;
    }

    const isCompliant = isBitlocker && isUsb && isEdr && patchOk;
    const badge = document.getElementById('modal-sec-badge');

    if (isCompliant) {
        badge.className = 'px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300';
        badge.innerHTML = '<i class="fas fa-check-circle mr-1 text-emerald-600"></i> Compliant';
    } else {
        badge.className = 'px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300';
        badge.innerHTML = '<i class="fas fa-exclamation-circle mr-1 text-rose-600"></i> Non-Compliant';
    }

    return isCompliant;
};

window.saveModalSecurity = () => {
    if (currentDetailIndex === null) return;

    const isCompliant = evaluateModalCompliance();
    const diskEncryption = document.getElementById('modal-sec-bitlocker').checked;
    const usbBlocked = document.getElementById('modal-sec-usb').checked;
    const edrActive = document.getElementById('modal-sec-edr').checked;
    const osBuild = document.getElementById('modal-sec-osbuild').value.trim();
    const lastPatchDate = document.getElementById('modal-sec-patchdate').value;

    const targetAsset = db.assets[currentDetailIndex];
    const timestamp = new Date().toISOString();

    targetAsset.security = {
        diskEncryption: diskEncryption,
        usbBlocked: usbBlocked,
        edrActive: edrActive,
        osBuild: osBuild,
        lastPatchDate: lastPatchDate,
        isCompliant: isCompliant,
        lastAuditedAt: timestamp
    };

    if (!targetAsset.auditHistory) targetAsset.auditHistory = [];
    const summaryText = `BitLocker:${diskEncryption ? 'ON' : 'OFF'} | USB:${usbBlocked ? 'BLOCK' : 'ALLOW'} | EDR:${edrActive ? 'ON' : 'OFF'} | Patch:${lastPatchDate || '-'}`;
    
    targetAsset.auditHistory.unshift({
        timestamp: timestamp,
        isCompliant: isCompliant,
        summary: summaryText
    });

    addAuditLog(
        'SECURITY_AUDIT',
        targetAsset.tag,
        `Audit saved (${isCompliant ? 'COMPLIANT' : 'NON-COMPLIANT'}) - ${summaryText}`
    );

    updateApp();
    renderAssetAuditHistory(targetAsset);
    alert('Security Audit saved & logged successfully!');
    closeDetailModal();
};

// ================= Accessories Management (With Location) =================
window.showAccessoryForm = (editIndex = null) => {
    DOM.viewAccessories.classList.add('hidden');
    DOM.viewAccessoryForm.classList.remove('hidden');
    DOM.tabsNav.classList.add('hidden');

    if (editIndex !== null) {
        DOM.accessoryFormTitle.innerText = "Edit Accessory";
        document.getElementById('editAccessoryIndex').value = editIndex;
        const acc = db.accessories[editIndex];
        document.getElementById('accId').value = acc.id;
        document.getElementById('accType').value = acc.type;
        document.getElementById('accLocation').value = acc.location || "";
        document.getElementById('accSerial').value = acc.serial || "";
        document.getElementById('accDesc').value = acc.desc;
        populateUserDropdown('accAssignedTo', acc.assignedTo || "");
    } else {
        DOM.accessoryFormTitle.innerText = "Add Accessory";
        document.getElementById('editAccessoryIndex').value = "";
        DOM.accessoryForm.reset();
        document.getElementById('accLocation').value = "";
        document.getElementById('accSerial').value = "";
        populateUserDropdown('accAssignedTo', "");
    }
};

window.hideAccessoryForm = () => {
    DOM.viewAccessoryForm.classList.add('hidden');
    DOM.viewAccessories.classList.remove('hidden');
    DOM.tabsNav.classList.remove('hidden');
};

function renderAccessoriesTable() {
    DOM.accessoryTableBody.innerHTML = '';
    
    if (db.accessories.length === 0) {
        DOM.accessoryTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="py-8 text-center text-sm text-gray-400">
                    No accessories recorded yet.
                </td>
            </tr>
        `;
        return;
    }

    db.accessories.forEach((acc, index) => {
        let icon = '<i class="fas fa-box text-gray-400"></i>';
        if (acc.type === 'iPhone') icon = '<i class="fas fa-mobile-alt text-slate-700"></i>';
        if (acc.type === 'iPad') icon = '<i class="fas fa-tablet-alt text-slate-700"></i>';
        if (acc.type === 'Monitor') icon = '<i class="fas fa-desktop text-blue-500"></i>';
        if (acc.type === 'Keyboard' || acc.type === 'Mouse') icon = '<i class="fas fa-mouse text-gray-500"></i>';

        let locBadge = 'bg-gray-100 text-gray-700 border-gray-200';
        if (acc.location === 'Safebox') locBadge = 'bg-amber-50 text-amber-700 border-amber-200';
        if (acc.location === 'IT') locBadge = 'bg-blue-50 text-blue-700 border-blue-200';
        if (acc.location === 'Secure Room') locBadge = 'bg-rose-50 text-rose-700 border-rose-200';

        const locHtml = acc.location 
            ? `<span class="px-2 py-0.5 rounded-full text-xs font-semibold border ${locBadge}"><i class="fas fa-map-marker-alt mr-1"></i>${acc.location}</span>` 
            : '<span class="text-gray-400 italic text-xs">-</span>';

        DOM.accessoryTableBody.innerHTML += `
            <tr class="hover:bg-slate-50 transition">
                <td class="py-3 px-4 font-mono text-sm font-semibold text-[#0b1f3a]">${acc.id}</td>
                <td class="py-3 px-4 text-sm">${icon} ${acc.type}</td>
                <td class="py-3 px-4 text-sm">${locHtml}</td>
                <td class="py-3 px-4 font-mono text-sm text-gray-500">${acc.serial || '-'}</td>
                <td class="py-3 px-4 text-gray-800">${acc.desc}</td>
                <td class="py-3 px-4 text-sm">${getAssignedUserName(acc.assignedTo)}</td>
                <td class="py-3 px-4 text-center space-x-2">
                    <button onclick="showAccessoryForm(${index})" class="text-blue-600 hover:text-blue-800" title="Edit"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteAccessory(${index})" class="text-rose-500 hover:text-rose-700" title="Delete"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

DOM.accessoryForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const editIndex = document.getElementById('editAccessoryIndex').value;
    const accData = {
        id: document.getElementById('accId').value.trim(),
        type: document.getElementById('accType').value,
        location: document.getElementById('accLocation').value,
        serial: document.getElementById('accSerial').value.trim(),
        desc: document.getElementById('accDesc').value.trim(),
        assignedTo: document.getElementById('accAssignedTo').value,
    };
    
    if (editIndex === "") {
        db.accessories.push(accData);
        addAuditLog('ACCESSORY_MGMT', accData.id, `Added accessory: ${accData.type} - ${accData.desc} (Loc: ${accData.location})`);
    } else {
        db.accessories[editIndex] = accData;
        addAuditLog('ACCESSORY_MGMT', accData.id, `Updated accessory: ${accData.type} (Loc: ${accData.location}, Assigned to: ${accData.assignedTo || 'Unassigned'})`);
    }
    
    hideAccessoryForm();
    updateApp();
});

window.deleteAccessory = (index) => {
    const acc = db.accessories[index];
    if(confirm(`Are you sure you want to delete ${acc.type} (${acc.id})?`)) {
        addAuditLog('ACCESSORY_MGMT', acc.id, `Deleted accessory: ${acc.type} - ${acc.desc}`);
        db.accessories.splice(index, 1);
        updateApp();
    }
};

// ================= Users Management =================
function renderUsersTable() {
    DOM.userTableBody.innerHTML = '';
    
    if (db.users.length === 0) {
        DOM.userTableBody.innerHTML = `
            <tr>
                <td colspan="9" class="py-8 text-center text-sm text-gray-400">
                    No employees registered yet.
                </td>
            </tr>
        `;
        return;
    }

    db.users.forEach((user, index) => {
        const isPermanent = (user.employmentType || 'Permanent') === 'Permanent';
        const typeBadge = isPermanent
            ? `<span class="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full text-xs font-semibold">Permanent</span>`
            : `<span class="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-xs font-semibold">Temporary</span>`;

        const isResigned = user.status === 'Resigned';
        const statusBadge = isResigned
            ? `<span class="bg-slate-100 text-slate-600 border border-slate-300 px-2 py-0.5 rounded-full text-xs font-medium">⚪ Resigned</span>`
            : `<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-xs font-semibold">🟢 Active</span>`;

        const rowStyle = isResigned ? 'bg-slate-50/60 opacity-80' : 'hover:bg-slate-50';

        DOM.userTableBody.innerHTML += `
            <tr class="${rowStyle} transition">
                <td class="py-3 px-4 font-mono text-sm font-semibold text-[#0b1f3a]">${user.empId}</td>
                <td class="py-3 px-4 font-medium text-slate-800 ${isResigned ? 'line-through text-gray-500' : ''}">
                    ${user.firstName} ${user.lastName}
                </td>
                <td class="py-3 px-4"><span class="bg-slate-100 text-[#0b1f3a] font-medium px-2 py-0.5 rounded text-xs">${user.dept}</span></td>
                <td class="py-3 px-4">${typeBadge}</td>
                <td class="py-3 px-4">${statusBadge}</td>
                <td class="py-3 px-4 font-mono text-xs text-gray-600">${user.startDate || '-'}</td>
                <td class="py-3 px-4 font-mono text-xs text-gray-600">${user.resignDate || '-'}</td>
                <td class="py-3 px-4 text-gray-600 text-xs">${user.email}</td>
                <td class="py-3 px-4 text-center space-x-2">
                    <button onclick="editUser(${index})" class="text-blue-600 hover:text-blue-800" title="Edit Employee"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteUser(${index})" class="text-rose-500 hover:text-rose-700" title="Delete Employee"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

window.editUser = (index) => {
    const user = db.users[index];
    if (!user) return;

    document.getElementById('editUserIndex').value = index;
    document.getElementById('empId').value = user.empId;
    document.getElementById('firstName').value = user.firstName;
    document.getElementById('lastName').value = user.lastName;
    document.getElementById('email').value = user.email;
    document.getElementById('dept').value = user.dept;
    document.getElementById('employmentType').value = user.employmentType || 'Permanent';
    document.getElementById('userStatus').value = user.status || 'Active';
    document.getElementById('startDate').value = user.startDate || '';
    document.getElementById('resignDate').value = user.resignDate || '';

    DOM.userFormTitle.innerHTML = `<i class="fas fa-user-edit mr-2 text-amber-600"></i> Edit Employee: ${user.firstName} (${user.empId})`;
    DOM.saveUserBtn.innerHTML = `<i class="fas fa-save mr-2"></i> Update Employee`;
    DOM.saveUserBtn.className = "bg-amber-600 text-white px-6 py-2.5 rounded-lg hover:bg-amber-700 transition text-sm font-semibold shadow-sm flex items-center";
    DOM.cancelEditUserBtn.classList.remove('hidden');

    DOM.userForm.scrollIntoView({ behavior: 'smooth' });
};

window.resetUserForm = () => {
    document.getElementById('editUserIndex').value = '';
    DOM.userForm.reset();
    document.getElementById('employmentType').value = 'Permanent';
    document.getElementById('userStatus').value = 'Active';

    DOM.userFormTitle.innerHTML = `<i class="fas fa-user-plus mr-2 text-blue-600"></i> Add New Employee`;
    DOM.saveUserBtn.innerHTML = `<i class="fas fa-user-plus mr-2"></i> Add Employee`;
    DOM.saveUserBtn.className = "bg-[#0b1f3a] text-white px-6 py-2.5 rounded-lg hover:bg-[#071526] transition text-sm font-semibold shadow-sm flex items-center";
    DOM.cancelEditUserBtn.classList.add('hidden');
};

DOM.userForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const editIndex = document.getElementById('editUserIndex').value;

    const userData = {
        empId: document.getElementById('empId').value.trim(),
        firstName: document.getElementById('firstName').value.trim(),
        lastName: document.getElementById('lastName').value.trim(),
        dept: document.getElementById('dept').value,
        employmentType: document.getElementById('employmentType').value,
        status: document.getElementById('userStatus').value,
        startDate: document.getElementById('startDate').value,
        resignDate: document.getElementById('resignDate').value,
        email: document.getElementById('email').value.trim(),
    };

    if (editIndex === "") {
        db.users.push(userData);
        addAuditLog('USER_MGMT', userData.empId, `Added employee: ${userData.firstName} ${userData.lastName} (${userData.dept} | ${userData.status})`);
    } else {
        db.users[editIndex] = userData;
        addAuditLog('USER_MGMT', userData.empId, `Updated employee: ${userData.firstName} ${userData.lastName} (Status: ${userData.status})`);
    }

    resetUserForm();
    updateApp();
});

window.deleteUser = (index) => {
    const u = db.users[index];
    if(confirm(`Are you sure you want to delete employee ${u.firstName} ${u.lastName} (${u.empId})?`)) {
        addAuditLog('USER_MGMT', u.empId, `Deleted employee: ${u.firstName} ${u.lastName}`);
        db.users.splice(index, 1);
        updateApp();
    }
};

// ================= Logs Management =================
function renderLogsTable() {
    if (!DOM.logTableBody) return;
    DOM.logTableBody.innerHTML = '';
    const logs = db.logs || [];

    if (logs.length === 0) {
        DOM.logTableBody.innerHTML = `
            <tr>
                <td colspan="4" class="py-8 text-center text-sm text-gray-400">
                    No activity logs recorded yet.
                </td>
            </tr>
        `;
        return;
    }

    logs.forEach(log => {
        let catBadge = 'bg-gray-100 text-gray-700';
        if (log.category === 'SECURITY_AUDIT') catBadge = 'bg-emerald-100 text-emerald-800 font-semibold';
        if (log.category === 'SECURITY') catBadge = 'bg-emerald-100 text-emerald-800';
        if (log.category === 'ASSET_MGMT') catBadge = 'bg-blue-100 text-blue-800';
        if (log.category === 'ACCESSORY_MGMT') catBadge = 'bg-purple-100 text-purple-800';
        if (log.category === 'USER_MGMT') catBadge = 'bg-amber-100 text-amber-800';

        DOM.logTableBody.innerHTML += `
            <tr class="hover:bg-gray-50 transition text-sm">
                <td class="py-2.5 px-4 font-mono text-xs text-gray-500 whitespace-nowrap">
                    ${new Date(log.timestamp).toLocaleString()}
                </td>
                <td class="py-2.5 px-4">
                    <span class="px-2 py-0.5 rounded text-xs ${catBadge}">${log.category}</span>
                </td>
                <td class="py-2.5 px-4 font-mono text-xs font-semibold text-[#0b1f3a]">
                    ${log.target || '-'}
                </td>
                <td class="py-2.5 px-4 text-gray-700 text-xs">
                    ${log.details}
                </td>
            </tr>
        `;
    });
}

window.clearAllLogs = () => {
    if (confirm('Are you sure you want to clear all activity logs?')) {
        db.logs = [];
        updateApp();
    }
};

// ================= Import / Export =================
DOM.exportBtn.addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `rakkar_inventory_backup_${new Date().toISOString().split('T')[0]}.json`);
    dlAnchorElem.click();
});

DOM.importBtn.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const importedData = JSON.parse(event.target.result);
            if (importedData.assets && importedData.users) {
                if (!importedData.accessories) importedData.accessories = [];
                if (!importedData.logs) importedData.logs = [];
                db = importedData;
                addAuditLog('SYSTEM', 'DATABASE', 'Imported JSON database backup');
                updateApp();
                alert('Import successful!');
            } else {
                alert('Invalid JSON format.');
            }
        } catch (err) {
            alert('Invalid JSON file');
        }
    };
    reader.readAsText(file);
});

// ================= Export Security Audit Report (CSV) =================
window.exportSecurityReportCSV = () => {
    if (db.assets.length === 0) {
        alert('No computer assets to export.');
        return;
    }

    const headers = [
        "Asset Tag",
        "Model",
        "OS",
        "Serial Number",
        "Status",
        "Assigned User (EMP ID)",
        "Compliance Status",
        "Disk Encryption",
        "USB Blocked",
        "EDR Active",
        "OS Build",
        "Last Patch Date",
        "Last Audited At"
    ];

    const rows = db.assets.map(a => {
        const sec = a.security || {};
        let complianceText = !a.security ? "Not Audited" : (sec.isCompliant ? "Compliant" : "Non-Compliant");
        
        return [
            `"${a.tag || ''}"`,
            `"${(a.model || '').replace(/"/g, '""')}"`,
            `"${a.os || ''}"`,
            `"${a.serial || ''}"`,
            `"${a.status || ''}"`,
            `"${a.assignedTo || 'Unassigned'}"`,
            `"${complianceText}"`,
            sec.diskEncryption ? "YES" : "NO",
            sec.usbBlocked ? "YES" : "NO",
            sec.edrActive ? "YES" : "NO",
            `"${sec.osBuild || ''}"`,
            `"${sec.lastPatchDate || ''}"`,
            `"${sec.lastAuditedAt ? new Date(sec.lastAuditedAt).toLocaleString() : ''}"`
        ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const today = new Date().toISOString().split('T')[0];
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Rakkar_Security_Compliance_Report_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDetailModal();
});

// ================= GITHUB API AUTO-SYNC MODULE =================
const GH_CONFIG = {
    repo: 'cyberjo3/ComputerINV',
    path: 'data.json',
    branch: 'main'
};

function getGitHubToken() {
    return localStorage.getItem('gh_sync_token') || '';
}

window.openSettingsModal = () => {
    document.getElementById('ghTokenInput').value = getGitHubToken();
    document.getElementById('settingsModal').classList.remove('hidden');
};

window.closeSettingsModal = () => {
    document.getElementById('settingsModal').classList.add('hidden');
};

window.saveGitHubSettings = () => {
    const token = document.getElementById('ghTokenInput').value.trim();
    if (!token) {
        localStorage.removeItem('gh_sync_token');
        alert('GitHub Token cleared. Auto-sync disabled.');
    } else {
        localStorage.setItem('gh_sync_token', token);
        alert('GitHub Token saved! Testing connection...');
        pullDataFromGitHub(true);
    }
    closeSettingsModal();
};

async function pullDataFromGitHub(notify = false) {
    const token = getGitHubToken();
    if (!token) return;

    const url = `https://api.github.com/repos/${GH_CONFIG.repo}/contents/${GH_CONFIG.path}?ref=${GH_CONFIG.branch}`;
    
    try {
        const res = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (res.status === 200) {
            const data = await res.json();
            const content = decodeURIComponent(escape(atob(data.content)));
            const parsed = JSON.parse(content);

            if (parsed.assets && parsed.users) {
                db = parsed;
                localStorage.setItem('it-inventory-db', JSON.stringify(db));
                sessionStorage.setItem('gh_file_sha', data.sha);
                renderAssetsTable();
                renderAccessoriesTable();
                renderUsersTable();
                renderLogsTable();
                updateStats();
                if (notify) alert('Cloud Sync: Loaded latest data from GitHub successfully!');
            }
        } else if (res.status === 404) {
            if (notify) alert('File data.json does not exist yet. It will be created on the first save.');
        } else {
            if (notify) alert(`GitHub API Error: ${res.statusText}`);
        }
    } catch (err) {
        console.error('Failed to pull from GitHub:', err);
    }
}

async function pushDataToGitHub() {
    const token = getGitHubToken();
    if (!token) return;

    const url = `https://api.github.com/repos/${GH_CONFIG.repo}/contents/${GH_CONFIG.path}`;
    
    let sha = sessionStorage.getItem('gh_file_sha');
    try {
        const checkRes = await fetch(`${url}?ref=${GH_CONFIG.branch}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (checkRes.ok) {
            const checkData = await checkRes.json();
            sha = checkData.sha;
        }
    } catch (e) {}

    const jsonStr = JSON.stringify(db, null, 2);
    const contentBase64 = btoa(unescape(encodeURIComponent(jsonStr)));

    const body = {
        message: `Auto-sync: update inventory (${new Date().toLocaleString()})`,
        content: contentBase64,
        branch: GH_CONFIG.branch
    };
    if (sha) body.sha = sha;

    try {
        const res = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify(body)
        });

        if (res.ok) {
            const resData = await res.json();
            sessionStorage.setItem('gh_file_sha', resData.content.sha);
            console.log('GitHub Auto-sync: Committed successfully.');
        } else {
            console.warn('GitHub Auto-sync failed:', await res.text());
        }
    } catch (err) {
        console.error('GitHub Auto-sync Network Error:', err);
    }
}

// ================= Initialization =================
checkAuthStatus();
updateApp();
pullDataFromGitHub();