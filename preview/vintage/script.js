// ============================================================
// Lê o objeto DADOS (de dados.js) e monta a página.
// Suporta dois modos, sem precisar editar nada aqui:
//   1) Uso normal  — DADOS vem do arquivo dados.js (global)
//   2) Modo prévia — DADOS chega via postMessage (Painel de Configuração)
// Fotos e música podem ser um nome de arquivo (imagens/foto.jpg)
// OU um data: URI (base64 embutido). As duas formas funcionam.
// ============================================================

function corVar(nome) {
    const mapa = { algodao: 'var(--algodao)', manteiga: 'var(--manteiga)', menta: 'var(--menta)' };
    return mapa[nome] || 'var(--creme)';
}

// Aceita tanto "foto.jpg" (vira imagens/foto.jpg) quanto um data: URI já pronto
function midiaSrc(valor, pasta) {
    if (!valor) return '';
    return valor.startsWith('data:') ? valor : `${pasta}/${valor}`;
}

function escapar(txt) {
    const div = document.createElement('div');
    div.textContent = txt == null ? '' : txt;
    return div.innerHTML;
}

// ------------------------------------------------------------
// Renderiza (ou re-renderiza) todo o conteúdo a partir de DADOS
// ------------------------------------------------------------
function renderSite(DADOS) {
    // ---- Capa / Hero ----
    document.getElementById('capa-titulo-texto').textContent = DADOS.capaTitulo || '';
    document.getElementById('capa-dica-texto').textContent = DADOS.capaDica || '';
    document.getElementById('hero-eyebrow').textContent = DADOS.heroEyebrow || '';
    document.getElementById('hero-subtitulo').textContent = DADOS.heroSubtitulo || '';
    document.getElementById('hero-texto').textContent = DADOS.heroTexto || '';

    // Título do hero: a última palavra fica destacada em rosa
    (function montarTituloHero() {
        const palavras = (DADOS.heroTitulo || '').trim().split(' ').filter(Boolean);
        const heroTitulo = document.getElementById('hero-titulo');
        heroTitulo.textContent = '';
        if (!palavras.length) return;
        const ultima = palavras.pop();
        heroTitulo.append(palavras.length ? palavras.join(' ') + ' ' : '');
        const em = document.createElement('em');
        em.textContent = ultima;
        heroTitulo.appendChild(em);
    })();

    // ---- Bilhetes ----
    (function montarBilhetes() {
        const container = document.getElementById('mural-bilhetes');
        container.innerHTML = '';
        (DADOS.bilhetes || []).forEach(b => {
            const div = document.createElement('div');
            div.className = 'bilhete';
            div.style.setProperty('--cor', corVar(b.cor));
            div.style.setProperty('--tilt', `${b.tilt || 0}deg`);
            div.innerHTML = `<p>${escapar(b.texto)}</p><span class="bilhete-rabisco">${escapar(b.rabisco)}</span>`;
            container.appendChild(div);
        });
    })();

    // ---- Mural de fotos ----
    (function montarFotos() {
        const container = document.getElementById('mural-fotos');
        container.innerHTML = '';
        (DADOS.fotos || []).forEach(f => {
            const div = document.createElement('div');
            div.className = 'foto' + (f.tamanho && f.tamanho !== 'normal' ? ` foto--${f.tamanho}` : '');

            const src = midiaSrc(f.arquivo, 'imagens');
            const conteudoFoto = src
                ? `<div class="foto-recorte"><img src="${src}" alt="${escapar(f.legenda)}"></div>`
                : `<div class="foto-placeholder"><svg class="icon" aria-hidden="true"><use href="#icon-camera"/></svg><span>${escapar(f.legenda)}</span></div>`;

            div.innerHTML = `
                <div class="foto-moldura">${conteudoFoto}</div>
                ${src ? `<p>${escapar(f.legenda)}</p>` : ''}
            `;
            container.appendChild(div);
        });
    })();

    // ---- Varal de motivos ----
    (function montarMotivos() {
        const container = document.getElementById('varal-coracoes');
        container.innerHTML = '';
        const cores = ['algodao', 'menta', 'manteiga'];
        (DADOS.motivos || []).forEach((m, i) => {
            const div = document.createElement('div');
            div.className = 'varal-coracao';
            div.style.setProperty('--cor', corVar(cores[i % cores.length]));
            div.innerHTML = `
                <svg class="icon" aria-hidden="true"><use href="#icon-heart"/></svg>
                <h3>${escapar(m.titulo)}</h3>
                <p>${escapar(m.texto)}</p>
            `;
            container.appendChild(div);
        });
    })();

    // ---- Raspadinhas ----
    criarRaspadinhas(DADOS.surpresas || []);

    // ---- Música de fundo ----
    const bgMusic = document.getElementById('bg-music');
    const musicToggle = document.getElementById('music-toggle');
    const src = midiaSrc(DADOS.musica, 'musica');
    if (src) {
        bgMusic.src = src;
        musicToggle.classList.remove('sem-musica');
    } else {
        bgMusic.removeAttribute('src');
        musicToggle.classList.add('sem-musica');
    }
}

// ------------------------------------------------------------
// Raspadinhas (canvas). Reconstrói do zero a cada chamada.
// O visual (cores da cobertura, cor/fonte do símbolo e o próprio
// símbolo) vem de variáveis CSS do tema — assim ESTE arquivo é
// idêntico em todos os temas; só o styles.css muda.
// ------------------------------------------------------------
function raspConfig() {
    const cs = getComputedStyle(document.documentElement);
    const v = (nome, fallback) => (cs.getPropertyValue(nome).trim() || fallback);
    const semAspas = s => s.replace(/^['"]|['"]$/g, '');
    return {
        cores: [v('--rasp-c1', '#ffd3e2'), v('--rasp-c2', '#fff1c2'), v('--rasp-c3', '#cdeede')],
        fill: v('--rasp-fill', '#4a2e44'),
        font: v('--rasp-font', '700 16px Quicksand'),
        simbolo: semAspas(v('--rasp-simbolo', '♥')),
    };
}

function criarRaspadinhas(surpresas) {
    const container = document.getElementById('raspadinhas');
    container.innerHTML = '';
    const embaralhadas = [...surpresas].sort(() => Math.random() - 0.5);
    const rasp = raspConfig();

    embaralhadas.forEach((texto, i) => {
        const card = document.createElement('div');
        card.className = 'raspadinha';
        card.innerHTML = `
            <div class="raspadinha-texto">${escapar(texto)}</div>
            <canvas width="170" height="170"></canvas>
            <span class="raspadinha-dica">raspe aqui</span>
        `;
        container.appendChild(card);

        const canvas = card.querySelector('canvas');
        const dica = card.querySelector('.raspadinha-dica');
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = rasp.cores[i % rasp.cores.length];
        ctx.beginPath();
        ctx.arc(85, 85, 85, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = rasp.fill;
        ctx.font = rasp.font;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(rasp.simbolo, 85, 85);

        let raspando = false;
        let revelado = false;

        function raspar(x, y) {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.arc(x, y, 16, 0, Math.PI * 2);
            ctx.fill();
        }

        function posicaoRelativa(evento) {
            const rect = canvas.getBoundingClientRect();
            return {
                x: ((evento.clientX - rect.left) / rect.width) * canvas.width,
                y: ((evento.clientY - rect.top) / rect.height) * canvas.height
            };
        }

        function verificarRevelado() {
            if (revelado) return;
            const dados = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            let transparentes = 0;
            for (let p = 3; p < dados.length; p += 4) {
                if (dados[p] === 0) transparentes++;
            }
            const proporcao = transparentes / (canvas.width * canvas.height);
            if (proporcao > 0.5) {
                revelado = true;
                canvas.style.transition = 'opacity 0.4s ease';
                canvas.style.opacity = '0';
                dica.style.display = 'none';
                setTimeout(() => canvas.remove(), 400);
            }
        }

        canvas.addEventListener('pointerdown', (e) => {
            raspando = true;
            dica.style.display = 'none';
            const { x, y } = posicaoRelativa(e);
            raspar(x, y);
        });

        canvas.addEventListener('pointermove', (e) => {
            if (!raspando) return;
            const { x, y } = posicaoRelativa(e);
            raspar(x, y);
            verificarRevelado();
        });

        canvas.addEventListener('pointerup', () => {
            raspando = false;
            verificarRevelado();
        });

        canvas.addEventListener('pointerleave', () => {
            raspando = false;
        });
    });
}

// ------------------------------------------------------------
// Listeners que são configurados UMA vez só (não dependem de DADOS)
// ------------------------------------------------------------
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxCaption = document.getElementById('lightbox-caption');

// Delegação: o mural é reconstruído a cada render, então ouvimos no container fixo
document.getElementById('mural-fotos').addEventListener('click', function (e) {
    const item = e.target.closest('.foto');
    if (!item) return;
    const img = item.querySelector('img');
    if (!img) return; // placeholder sem foto: não abre lightbox
    const legenda = item.querySelector('p');

    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt;
    lightboxCaption.textContent = legenda ? legenda.textContent : '';
    lightbox.classList.add('active');
    history.pushState({ lightboxAberto: true }, '');
});

function fecharLightbox() {
    lightbox.classList.remove('active');
    if (history.state && history.state.lightboxAberto) {
        history.back();
    }
}

// No celular, o botão "voltar" só fecha a foto em vez de sair do site
window.addEventListener('popstate', function () {
    lightbox.classList.remove('active');
});

lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) {
        fecharLightbox();
    }
});

document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && lightbox.classList.contains('active')) {
        fecharLightbox();
    }
});

// ---- Música: botão liga/desliga ----
const bgMusic = document.getElementById('bg-music');
const musicToggle = document.getElementById('music-toggle');

function atualizarBotaoMusica() {
    if (bgMusic.paused) {
        musicToggle.classList.remove('playing');
        musicToggle.classList.add('paused');
    } else {
        musicToggle.classList.remove('paused');
        musicToggle.classList.add('playing');
    }
}

musicToggle.addEventListener('click', function (e) {
    e.stopPropagation();
    if (!bgMusic.getAttribute('src')) return;
    if (bgMusic.paused) {
        bgMusic.play().then(atualizarBotaoMusica).catch(() => {});
    } else {
        bgMusic.pause();
        atualizarBotaoMusica();
    }
});

// ---- Tela de abertura: o toque pra entrar também libera a música ----
const capaToque = document.getElementById('capa-toque');

capaToque.addEventListener('click', function () {
    capaToque.classList.add('escondida');
    if (bgMusic.getAttribute('src')) {
        bgMusic.play().then(atualizarBotaoMusica).catch(() => atualizarBotaoMusica());
    }
});

// ------------------------------------------------------------
// Boot
// ------------------------------------------------------------
if (typeof DADOS !== 'undefined') {
    renderSite(DADOS);
}

// ---- Modo prévia (Painel de Configuração) ----
// O painel manda { tipo: 'via-preview', dados } sempre que o cliente edita.
window.addEventListener('message', function (e) {
    const msg = e.data;
    if (!msg || msg.tipo !== 'via-preview' || !msg.dados) return;
    capaToque.classList.add('escondida'); // na prévia, pula a tela de abertura
    renderSite(msg.dados);
});
