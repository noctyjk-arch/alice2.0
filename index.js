const axios = require("axios");
const cheerio = require("cheerio");

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const SITE_URL = "https://mangasbrasuka.com.br/";

let vistos = new Set();
let inicializado = false;

async function checkSite() {
  try {
    const res = await axios.get(SITE_URL);
    const $ = cheerio.load(res.data);

    let caps = [];

    $("a").each((i, el) => {
      const link = $(el).attr("href");
      if (!link) return;

      if (link.includes("/capitulo-")) {

        const fullLink = link.startsWith("http")
          ? link
          : SITE_URL + link;

        const partes = fullLink.split("/manga/")[1]?.split("/");
        if (!partes) return;

        const nome = partes[0]
          .replace(/-/g, " ")
          .replace(/\b\w/g, l => l.toUpperCase());

        const capMatch = fullLink.match(/capitulo-(\d+)/i);
        const numero = capMatch ? `Capítulo ${capMatch[1]}` : "";

        caps.push({ nome, numero, link: fullLink });
      }
    });

    // remove duplicados
    const únicos = [];
    const usado = new Set();

    for (const c of caps) {
      if (!usado.has(c.link)) {
        usado.add(c.link);
        únicos.push(c);
      }
    }

    const recentes = únicos.slice(0, 10);

    // primeira execução (não envia nada)
    if (!inicializado) {
      recentes.forEach(c => vistos.add(c.link + c.numero));
      inicializado = true;
      console.log("Inicializado sem enviar.");
      return;
    }

    const novos = recentes.filter(c => !vistos.has(c.link + c.numero));

    if (novos.length > 0) {
      for (const cap of novos) {

        await axios.post(WEBHOOK_URL, {
          username: "alice",
          content: `📢 Atualização
Acabou de sair o ${cap.numero} da
Obra: ${cap.nome}
Está disponível para ler em: ${cap.link}`
        });

        console.log("Enviado:", cap.nome, cap.numero);
      }

      vistos = new Set(recentes.map(c => c.link + c.numero));
    } else {
      console.log("Sem novidades.");
    }

  } catch (err) {
    console.log("Erro:", err.message);
  }
}

setInterval(checkSite, 5 * 60 * 1000);
checkSite();