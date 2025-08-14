// ==UserScript==
// @name         Vodafone Cash + Last Items إدارة متطورة بدون ريلود (مطور محسّن) - معدل
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  نسخة محسّنة بدون تخزين طلبات، مع تأكيد الكتابة قبل الإرسال + فحص عدم وجود عناصر من Last Items قبل الإرسال
// @author       You
// @match        https://console.foodics.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    //////////////////////////// إنشاء زر تأكيد فودافون كاش ////////////////////////////
    function createVodafoneCashButton() {
        const originalSubmit = document.getElementById('order.submit');
        if (!originalSubmit || document.getElementById('vodafoneCashConfirmBtn')) return;

        originalSubmit.style.display = 'none';

        const confirmBtn = document.createElement('button');
        confirmBtn.id = 'vodafoneCashConfirmBtn';
        confirmBtn.textContent = 'تأكيد الطلب';
        confirmBtn.className = 'custom-button';
        originalSubmit.parentNode.insertBefore(confirmBtn, originalSubmit);

        confirmBtn.addEventListener('click', async () => {
            const hasLastItem = await checkLastItemsInOrder();
            if (hasLastItem) {
                createWarningPopup('⚠️ يوجد عنصر من Last Items داخل الطلب، لا يمكن الإرسال!');
                return; // إيقاف الإرسال
            }
            openVodafoneCashPopup(async (confirmed) => {
                const noteField = document.getElementById('form_field_ملاحظات_الفاتورة');
                if (!noteField) {
                    createWarningPopup('⚠️ لم يتم العثور على حقل الملاحظات!');
                    return;
                }
                if (confirmed) {
                    await setNote(noteField, "");
                    setTimeout(() => {
                        if (noteField.value.includes("تم الدفع فودافون كاش")) {
                            originalSubmit.disabled = false;
                            originalSubmit.click();
                        } else {
                            createWarningPopup('⚠️ حدث خطأ: لم يتم كتابة الملاحظة بشكل صحيح!');
                        }
                    }, 300);
                } else {
                    originalSubmit.disabled = false;
                    originalSubmit.click();
                }
            });
        });
    }

    //////////////////////////// إنشاء زر إدارة Last Items ////////////////////////////
    function createLastItemsButton() {
        const vodafoneBtn = document.getElementById('vodafoneCashConfirmBtn');
        if (!vodafoneBtn || document.getElementById('lastItemsBtn')) return;

        const lastBtn = document.createElement('button');
        lastBtn.id = 'lastItemsBtn';
        lastBtn.textContent = 'إدارة Last Items';
        lastBtn.className = 'custom-button';
        vodafoneBtn.insertAdjacentElement('afterend', lastBtn);

        lastBtn.addEventListener('click', openLastItemsManager);
    }

    //////////////////////////// تصميم الأزرار ////////////////////////////
    const style = document.createElement('style');
    style.innerHTML = `
        .custom-button {
            background-color: #0066ff;
            color: white;
            font-size: 16px;
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            cursor: pointer;
            margin-top: 12px;
            font-weight: 600;
            transition: background-color 0.3s, transform 0.2s;
        }
        .custom-button:hover {
            background-color: #0052cc;
            transform: translateY(-2px);
        }
        .custom-button:active {
            background-color: #0041a8;
            transform: translateY(0);
        }
    `;
    document.head.appendChild(style);

    //////////////////////////// باقي الدوال ////////////////////////////

    async function getOrderItems() {
        const itemsElements = document.querySelectorAll('.py-4 .cursor-pointer .flex.justify-between .truncate .truncate label .font-semibold');
        const items = Array.from(itemsElements).map(el => el.textContent.trim());
        return items;
    }

    async function checkLastItemsInOrder() {
        const orderItems = await getOrderItems();
        const additionItemsElements = document.querySelectorAll('.truncate.me-2');
        const additionItems = Array.from(additionItemsElements).map(el => el.textContent.trim()).filter(Boolean);

        const lastItems = JSON.parse(localStorage.getItem('lastItems') || '[]');
        const allItems = [...orderItems, ...additionItems];

        return allItems.some(orderItem =>
            lastItems.some(lastItem =>
                orderItem.includes(lastItem) || lastItem.includes(orderItem)
            ) || lastItems.includes(orderItem)
        );
    }

    async function checkDuplicateOrders() {
        return false;
    }

    function popupTemplate(title, content, width = '450px') {
        return `
        <style>
            #popupOverlay {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background-color: rgba(0,0,0,0.4);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 999999;
            }
            #popupBox {
                background: white;
                padding: 30px;
                border-radius: 20px;
                width: ${width};
                text-align: center;
                position: relative;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            }
            #popupTitle {
                font-size: 22px;
                font-weight: bold;
                margin-bottom: 20px;
                color: #333;
            }
            #popupClose {
                position: absolute;
                top: 10px;
                right: 10px;
                background: #ff4d4d;
                border: none;
                color: white;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                cursor: pointer;
            }
            #popupButtons {
                display: flex;
                justify-content: center;
                gap: 20px;
                flex-wrap: wrap;
            }
            #popupButtons button {
                padding: 10px 20px;
                border: none;
                border-radius: 8px;
                font-weight: bold;
                cursor: pointer;
                font-size: 16px;
            }
        </style>
        <div id="popupOverlay">
            <div id="popupBox">
                <button id="popupClose">×</button>
                <div id="popupTitle">${title}</div>
                <div id="popupButtons">${content}</div>
            </div>
        </div>`;
    }

    function openVodafoneCashPopup(onDecision) {
        const div = document.createElement('div');
        div.innerHTML = popupTemplate('تأكيد فودافون كاش', `
            <div style="display: flex; justify-content: center; gap: 40px;">
                <button id="cancelPayment" style="background:#e74c3c; color:white;">لا</button>
                <button id="confirmPayment" style="background:#2ecc71; color:white;">نعم</button>
            </div>
        `, '400px');
        document.body.appendChild(div);

        div.querySelector('#popupClose').onclick = () => div.remove();
        div.querySelector('#cancelPayment').onclick = () => {
            div.remove();
            onDecision(false);
        };
        div.querySelector('#confirmPayment').onclick = () => {
            div.remove();
            onDecision(true);
        };
    }

    function openLastItemsManager() {
        const div = document.createElement('div');
        div.innerHTML = popupTemplate('إدارة Last Items', `
            <button id="addLastItem" style="background:#3498db; color:white;">➕ إضافة</button>
            <button id="deleteLastItem" style="background:#f39c12; color:white;">🗑️ حذف</button>
            <button id="deleteAllLastItems" style="background:#e74c3c; color:white;">🔥 حذف الكل</button>
        `);
        document.body.appendChild(div);

        div.querySelector('#popupClose').onclick = () => div.remove();
        div.querySelector('#addLastItem').onclick = () => { div.remove(); addLastItems(); };
        div.querySelector('#deleteLastItem').onclick = () => { div.remove(); deleteLastItems(); };
        div.querySelector('#deleteAllLastItems').onclick = () => {
            localStorage.removeItem('lastItems');
            div.remove();
            createWarningPopup('✅ تم حذف جميع العناصر.');
        };
    }

    function addLastItems() {
        const div = document.createElement('div');
        div.innerHTML = popupTemplate('➕ إضافة عناصر', `
            <textarea id="lastItemsInput" placeholder="اكتب العناصر مفصولة بـ ," style="width:90%; height:100px; padding:10px; border-radius:8px;"></textarea>
            <br><br>
            <button id="saveItems" style="background:#3498db; color:white;">💾 حفظ</button>
        `);
        document.body.appendChild(div);

        div.querySelector('#popupClose').onclick = () => div.remove();
        div.querySelector('#saveItems').onclick = () => {
            const input = document.getElementById('lastItemsInput').value;
            if (input.trim()) {
                const items = input.split(',').map(item => item.trim()).filter(item => item);
                const current = JSON.parse(localStorage.getItem('lastItems') || '[]');
                localStorage.setItem('lastItems', JSON.stringify(current.concat(items)));
                div.remove();
                createWarningPopup('✅ تم حفظ العناصر.');
            }
        };
    }

    function deleteLastItems() {
        const lastItems = JSON.parse(localStorage.getItem('lastItems') || '[]');
        if (lastItems.length === 0) {
            createWarningPopup('⚠️ لا يوجد عناصر!');
            return;
        }

        let itemsHTML = `
            <select id="lastItemsDropdown" style="width:90%; padding:10px; border-radius:8px;">
                ${lastItems.map((item, index) => `<option value="${index}">${item}</option>`).join('')}
            </select>
            <br><br>
            <button id="deleteSelectedItem" style="background:red; color:white;">🗑️ حذف المحدد</button>
        `;

        const div = document.createElement('div');
        div.innerHTML = popupTemplate('🗑️ حذف عنصر', itemsHTML);
        document.body.appendChild(div);

        div.querySelector('#popupClose').onclick = () => div.remove();
        div.querySelector('#deleteSelectedItem').onclick = () => {
            const selectedIndex = parseInt(document.getElementById('lastItemsDropdown').value);
            lastItems.splice(selectedIndex, 1);
            localStorage.setItem('lastItems', JSON.stringify(lastItems));
            div.remove();
            deleteLastItems();
        };
    }

    function createWarningPopup(message) {
        const div = document.createElement('div');
        div.innerHTML = popupTemplate('⚠️ تنبيه', `
            <div style="font-size:18px; font-weight:bold; color:#333;">${message}</div>
            <button id="okBtn" style="background:#3498db; color:white;">حسناً</button>
        `);
        document.body.appendChild(div);

        div.querySelector('#popupClose').onclick = () => div.remove();
        div.querySelector('#okBtn').onclick = () => div.remove();
    }

    async function setNote(field, text) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        setter.call(field, field.value + (field.value ? '\n' : '') + text);
        field.dispatchEvent(new Event('input', { bubbles: true }));
    }

    //////////////////////////// تشغيل الكود عند تغيير الصفحة ////////////////////////////
    const observer = new MutationObserver(() => {
        createVodafoneCashButton();
        createLastItemsButton();
    });

    observer.observe(document.body, { childList: true, subtree: true });

})();
