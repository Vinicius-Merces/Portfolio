// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAmrAtNIsd7Bp-tRAmavI-wwlLgd4_zkEc",
    authDomain: "julianabeauty.firebaseapp.com",
    projectId: "julianabeauty",
    storageBucket: "julianabeauty.firebasestorage.app",
    messagingSenderId: "881281165323",
    appId: "1:881281165323:web:4c8e5a1e7ca37272a27f0e",
    measurementId: "G-GD2V0K5TF4"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

class AgendamentoManager {
    constructor() {
        this.form = document.getElementById("agendamentoForm");
        this.loadingSpinner = document.getElementById("loadingSpinner");
        this.statusMessageDiv = document.getElementById("statusMessage");
        this.dataInput = document.getElementById("dataHora");
        
        this.initEventListeners();
        this.configurarDataMinima();
    }

    initEventListeners() {
        if (this.form) {
            this.form.addEventListener("submit", async (e) => await this.handleSubmit(e));
            
            // Validação em tempo real
            this.form.querySelectorAll("input, select").forEach(element => {
                element.addEventListener("input", () => {
                    if (element.checkValidity()) {
                        element.classList.remove("is-invalid");
                    }
                });
            });
        }
    }

    configurarDataMinima() {
        if (this.dataInput) {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            
            this.dataInput.min = `${year}-${month}-${day}T${hours}:${minutes}`;
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        // Validar formulário
        if (!this.form.checkValidity()) {
            this.form.querySelectorAll(":invalid").forEach(element => {
                element.classList.add("is-invalid");
            });
            
            this.showMessage("Por favor, preencha todos os campos obrigatórios corretamente.", "danger");
            return;
        }

        const btn = this.form.querySelector("button[type=\"submit\"]");
        btn.disabled = true;
        this.loadingSpinner.style.display = "inline-block";
        this.clearMessage();

        try {
            const agendamento = {
                nome: document.getElementById("nomeCompleto").value.trim(),
                whatsapp: document.getElementById("whatsapp").value.trim(),
                servico: document.getElementById("servico").value,
                dataHoraISO: document.getElementById("dataHora").value,
                observacoes: document.getElementById("observacoes").value.trim(),
                status: "pendente",
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Validações adicionais
            await this.validarAgendamento(agendamento);

            // Verificar disponibilidade antes de agendar
            await this.verificarDisponibilidade(agendamento.dataHoraISO);

            agendamento.dataHoraISO = new Date(agendamento.dataHoraISO).toISOString().slice(0, 16);

            // Salvar no Firestore
            const docRef = await db.collection("agendamentos").add(agendamento);
            
            // Enviar para WhatsApp
            await this.enviarWhatsApp(agendamento, docRef.id);

            // Feedback ao usuário
            this.showMessage(`
                <h5 class="alert-heading">Agendamento confirmado!</h5>
                <p>Verifique seu WhatsApp para receber os detalhes.</p>
                <hr>
                <p class="mb-0">Código do agendamento: <strong>${docRef.id.substring(0, 8)}</strong></p>
            `, "success");
            
            // Resetar formulário
            this.form.reset();
            this.form.classList.remove("was-validated");
            this.configurarDataMinima();

        } catch (error) {
            console.error("Erro no agendamento:", error);
            this.showMessage(`
                <h5 class="alert-heading">Erro no agendamento</h5>
                <p>${error.message}</p>
            `, "danger");
        } finally {
            btn.disabled = false;
            this.loadingSpinner.style.display = "none";
        }
    }

    // ... (mantenha a configuração do Firebase e o restante do código igual)

async verificarDisponibilidade(dataHoraISO) {
    // Converter a string ISO para objeto Date
    const dataAgendamento = new Date(dataHoraISO);
    
    // Definir janela de 1 hora (30 minutos antes e depois)
    const inicio = new Date(dataAgendamento.getTime() - 30 * 60 * 1000);
    const fim = new Date(dataAgendamento.getTime() + 30 * 60 * 1000);
    
    // Formatando as datas no mesmo formato que está no Firebase (ISO string sem timezone)
    const formatarParaFirebase = (date) => {
        return date.toISOString().slice(0, 16); // Formato "YYYY-MM-DDTHH:MM"
    };
    
    const inicioFormatado = formatarParaFirebase(inicio);
    const fimFormatado = formatarParaFirebase(fim);
    const dataAgendamentoFormatada = formatarParaFirebase(dataAgendamento);
    
    try {
        // Verificar agendamento no horário exato
        const snapshotExato = await db.collection("agendamentos")
            .where("dataHoraISO", "==", dataAgendamentoFormatada)
            .get();
            
        if (!snapshotExato.empty) {
            throw new Error("Já existe um agendamento para este horário exato. Por favor, escolha outro horário.");
        }
        
        // Verificar agendamentos na janela de 30 minutos antes/depois
        const snapshotProximos = await db.collection("agendamentos")
            .where("dataHoraISO", ">=", inicioFormatado)
            .where("dataHoraISO", "<=", fimFormatado)
            .get();
            
        if (!snapshotProximos.empty) {
            throw new Error("Existe um agendamento muito próximo a este horário (30 minutos antes ou depois). Por favor, escolha outro horário.");
        }
    } catch (error) {
        console.error("Erro ao verificar disponibilidade:", error);
        throw error;
    }
}

// ... (mantenha o restante do código igual)

    async validarAgendamento(agendamento) {
        // Verificar campos obrigatórios
        if (!agendamento.nome || !agendamento.whatsapp || !agendamento.servico || !agendamento.dataHoraISO) {
            throw new Error("Por favor, preencha todos os campos obrigatórios.");
        }

        // Validar data/hora
        const dataAgendamento = new Date(agendamento.dataHoraISO);
        const agora = new Date();
        
        if (isNaN(dataAgendamento.getTime())) {
            throw new Error("Data ou hora inválida.");
        }

        // Verificar antecedência mínima (2 horas)
        const horaMinima = new Date(agora.getTime() + 2 * 60 * 60 * 1000);
        if (dataAgendamento < horaMinima) {
            throw new Error("O agendamento deve ser feito com pelo menos 2 horas de antecedência.");
        }

        // Verificar horário comercial (9h-19h)
        const hora = dataAgendamento.getHours();
        if (hora < 9 || hora >= 19) {
            throw new Error("Horário fora do nosso funcionamento (9h às 19h)");
        }

        // Verificar se não é final de semana
        if (dataAgendamento.getDay() === 0 || dataAgendamento.getDay() === 6) {
            throw new Error("Não trabalhamos aos finais de semana");
        }

        // Validar WhatsApp (11 dígitos)
        if (!/^\d{11}$/.test(agendamento.whatsapp)) {
            throw new Error("Número de WhatsApp inválido. Use 11 dígitos (DDD + número).");
        }
    }

    async enviarWhatsApp(agendamento, id) {
        const dataAgendamento = new Date(agendamento.dataHoraISO);
        const dataFormatada = dataAgendamento.toLocaleString("pt-BR", { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit', 
            minute: '2-digit'
        });

        const mensagem = `✅ *Agendamento Confirmado - BeautyLash Studio* ✅\n\n`
            + `*Código:* ${id.substring(0, 8)}\n`
            + `*Nome:* ${agendamento.nome}\n`
            + `*Serviço:* ${agendamento.servico}\n`
            + `*Data/Hora:* ${dataFormatada}\n`
            + `*Observações:* ${agendamento.observacoes || 'Nenhuma'}\n\n`
            + `_Aguardamos você no studio! Qualquer alteração, por favor, entre em contato._\n\n`
            + `📍 *Localização:* Rua da Beleza, 123 - São Paulo/SP\n`
            + `📞 *Telefone:* (11) 91271-2179`;

        const linkWhatsApp = `https://wa.me/5511912712179?text=${encodeURIComponent(mensagem)}`;
        
        // Abrir em nova aba após um pequeno delay
        setTimeout(() => {
            window.open(linkWhatsApp, "_blank");
        }, 500);
    }

    showMessage(message, type) {
        this.statusMessageDiv.innerHTML = `
            <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>`;
    }

    clearMessage() {
        this.statusMessageDiv.innerHTML = "";
    }
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    const agendamentoManager = new AgendamentoManager();
    
    // Adicionar classe de validação ao formulário
    const forms = document.querySelectorAll('.needs-validation');
    Array.from(forms).forEach(form => {
        form.addEventListener('submit', event => {
            if (!form.checkValidity()) {
                event.preventDefault();
                event.stopPropagation();
            }
            
            form.classList.add('was-validated');
        }, false);
    });
});