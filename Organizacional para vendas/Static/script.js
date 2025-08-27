document.addEventListener('DOMContentLoaded', () => {
    const table = document.getElementById('clients-table');
    const uploadForm = document.getElementById('upload-form');
    const addRowBtn = document.getElementById('add-row');
    const addColumnBtn = document.getElementById('add-column');
    const newColumnInput = document.getElementById('new-column');

    // Auto-save em edição
    table.addEventListener('input', (e) => {
        if (e.target.tagName === 'TD' && e.target.contentEditable) {
            const row = e.target.closest('tr');
            const id = row.dataset.id;
            const headers = Array.from(table.querySelectorAll('thead th')).slice(1, -1).map(th => th.textContent.trim().replace(' X', ''));
            const cells = row.querySelectorAll('td[contenteditable]');
            const data = {};
            headers.forEach((col, index) => {
                data[col] = cells[index].innerText;
            });
            fetch(`/update_client/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            }).then(res => res.json()).then(resData => console.log(resData));
        }
    });

    // Excluir linha
    table.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete')) {
            const row = e.target.closest('tr');
            const id = row.dataset.id;
            fetch(`/delete_client/${id}`, { method: 'POST' })
                .then(res => res.json())
                .then(resData => {
                    row.remove();
                    console.log(resData);
                });
        } else if (e.target.classList.contains('remove-column')) {
            const colName = e.target.dataset.col;
            fetch('/remove_column', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: colName })
            }).then(res => res.json()).then(resData => {
                location.reload();  // Recarrega para atualizar tabela
            });
        }
    });

    // Adicionar linha
    addRowBtn.addEventListener('click', () => {
        fetch('/add_client', { method: 'POST' })
            .then(res => res.json())
            .then(resData => {
                const tbody = table.querySelector('tbody');
                const row = document.createElement('tr');
                row.dataset.id = resData.id;
                let inner = `<td>${resData.id}</td>`;
                Object.keys(resData.data).forEach(() => {
                    inner += `<td contenteditable="true"></td>`;
                });
                inner += `<td><button class="delete">Excluir</button></td>`;
                row.innerHTML = inner;
                tbody.appendChild(row);
            });
    });

    // Adicionar coluna
    addColumnBtn.addEventListener('click', () => {
        const colName = newColumnInput.value.trim();
        if (colName) {
            fetch('/add_column', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: colName })
            }).then(res => res.json()).then(resData => {
                newColumnInput.value = '';
                location.reload();
            });
        }
    });

    // Upload CSV
    uploadForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(uploadForm);
        fetch('/upload', { method: 'POST', body: formData })
            .then(res => res.json())
            .then(resData => {
                alert(resData.success || resData.error);
                location.reload();
            });
    });
});