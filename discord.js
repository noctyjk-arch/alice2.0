const { Client, GatewayIntentBits } = require("discord.js");
const { createClient } = require("@supabase/supabase-js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const supabase = createClient(
  "https://lttoegjwxfsrbpuoisth.supabase.co",
  "sb_publishable_ysy_mhKL5nlgbpku8ZMjvg_fH8lEaQQ"
);

const PREFIX = "!";
const OWNER_ID = "1400164749655674953";

let logs = [];
let ultimoErro = null;

function addLog(msg) {
  logs.push(msg);
  if (logs.length > 20) logs.shift();
  console.log(msg);
}

process.on("unhandledRejection", err => {
  ultimoErro = err.message;
  addLog("[ERRO] " + err.message);
});

client.on("ready", () => {
  addLog("Bot online");
});

function normalizar(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function similar(a, b) {
  if (a.includes(b) || b.includes(a)) return true;

  let erros = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) erros++;
  }

  return erros <= 3;
}

async function encontrarObra(nomeInput) {
  const { data } = await supabase.from("works").select("name");

  if (!data || data.length === 0) return null;

  const nome = normalizar(nomeInput);

  for (const w of data) {
    const base = normalizar(w.name);

    if (base === nome) return w.name;
    if (similar(base, nome)) return w.name;
  }

  return null;
}

async function garantirObra(nome) {
  const existente = await encontrarObra(nome);

  if (existente) return existente;

  await supabase.from("works").insert([{ name: nome }]);
  addLog(`[CATALOGO] nova obra: ${nome}`);
  return nome;
}

async function getSeguidores(nome) {
  const { data } = await supabase
    .from("followers")
    .select("user_id")
    .eq("obra", nome);

  return data ? data.map(u => u.user_id) : [];
}

async function seguir(userId, nome) {
  await supabase.from("followers").insert([{ user_id: userId, obra: nome }]);
}

async function parar(userId, nome) {
  await supabase
    .from("followers")
    .delete()
    .eq("user_id", userId)
    .eq("obra", nome);
}

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(" ");
    const cmd = (args.shift() || "").toLowerCase();
    const userId = message.author.id;
    const isOwner = userId === OWNER_ID;

    if (!cmd) {
      return message.reply("Comando não reconhecido ou não existe.");
    }

    if (cmd === "ajuda") {
      return message.reply(
`📌 COMANDOS

!seguir <obra>
!parar <obra>
!minhas
!limpar
!seguindo <obra>
!top

!status
!ping
!banco (admin)
!restart (admin)`
      );
    }

    if (message.content.toLowerCase() === "!e o que sobra pro beta?") {
      return message.reply("não sobra nada pro beta, brutal");
    }

    if (cmd === "banco") {
      if (!isOwner) return message.reply("Sem permissão.");

      const { data } = await supabase
        .from("followers")
        .select("user_id, obra");

      if (!data?.length) return message.reply("Banco vazio.");

      const map = {};

      data.forEach(r => {
        if (!map[r.user_id]) map[r.user_id] = [];
        map[r.user_id].push(r.obra);
      });

      let texto = "📂 Banco:\n\n";

      for (const [id, obras] of Object.entries(map)) {
        texto += `<@${id}> → ${obras.join(", ")}\n`;
      }

      return message.channel.send(texto.slice(0, 1900));
    }

    if (cmd === "status" || cmd === "ping") {
      if (!isOwner) return message.reply("Sem permissão.");

      const sent = await message.reply("...");
      const latency = sent.createdTimestamp - message.createdTimestamp;
      const apiPing = Math.round(client.ws.ping);

      return sent.edit(`Latência: ${latency}ms | API: ${apiPing}ms`);
    }

    if (cmd === "seguir") {
      const nomeOriginal = args.join(" ").trim();
      if (!nomeOriginal) {
        return message.reply("Comando não reconhecido ou não existe.");
      }

      let nome = await garantirObra(nomeOriginal);

      await seguir(userId, nome);
      addLog(`[SEGUIR] ${userId} -> ${nome}`);

      return message.reply(`Seguindo: ${nome}`);
    }

    if (cmd === "parar") {
      const nomeOriginal = args.join(" ").trim();
      if (!nomeOriginal) {
        return message.reply("Comando não reconhecido ou não existe.");
      }

      const nome = await encontrarObra(nomeOriginal) || normalizar(nomeOriginal);

      await parar(userId, nome);
      addLog(`[PARAR] ${userId} -X-> ${nome}`);

      return message.reply(`Parou: ${nome}`);
    }

    return message.reply("Comando não reconhecido ou não existe.");

  } catch (err) {
    addLog("[CRASH] " + err.message);
    message.reply("Erro interno.");
  }
});

client.on("messageCreate", async (message) => {
  if (!message.webhookId) return;

  const content = message.content;

  const match = content.match(/Obra:\s*(.+)/i);
  if (!match) return;

  const nome = normalizar(match[1]);
  const seguidores = await getSeguidores(nome);

  await message.delete();

  if (seguidores.length > 0) {
    await message.channel.send({
      content: seguidores.map(id => `<@${id}>`).join(" ") + " 📢 Atualização",
      allowedMentions: { users: seguidores },
      embeds: [{ description: content }]
    });
  } else {
    await message.channel.send({
      content: "📢 Atualização",
      embeds: [{ description: content }]
    });
  }
});

client.login(process.env.TOKEN);