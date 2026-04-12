const { Client, GatewayIntentBits } = require("discord.js");
const { createClient } = require("@supabase/supabase-js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// 🔥 SUPABASE
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

// 🔥 HELPERS
function normalizar(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
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

// 🔥 BOT
client.on("messageCreate", async (message) => {

  try {

    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(" ");
    const cmd = (args.shift() || "").toLowerCase();
    const userId = message.author.id;
    const isOwner = userId === OWNER_ID;

    // ❗ fallback global para comando vazio
    if (!cmd) {
      return message.reply("Comando não reconhecido ou não existe.");
    }

    // 🔥 MENU DE AJUDA
    if (cmd === "ajuda") {
      return message.reply(
`📌 COMANDOS

👤 Usuário:
!seguir <obra>
!parar <obra>
!minhas
!limpar
!seguindo <obra>
!top

⚙️ Sistema:
!status
!ping
!banco (admin)
!restart (admin)`
      );
    }

    // 🔥 MEME FIXO
    if (message.content.toLowerCase() === "!e o que sobra pro beta?") {
      return message.reply("não sobra nada pro beta, brutal");
    }

    // 🔒 BANCO
    if (cmd === "banco") {
      if (!isOwner) return message.reply("Sem permissão.");

      const { data, error } = await supabase
        .from("followers")
        .select("user_id, obra");

      if (error) {
        addLog("[ERRO BANCO] " + error.message);
        return message.reply("Erro ao acessar banco.");
      }

      if (!data || data.length === 0) {
        return message.reply("Banco vazio.");
      }

      const map = {};

      data.forEach(r => {
        if (!map[r.user_id]) map[r.user_id] = [];
        map[r.user_id].push(r.obra);
      });

      let texto = "📂 Banco de Dados:\n\n";

      for (const [id, obras] of Object.entries(map)) {
        texto += `<@${id}> → ${obras.join(", ")}\n`;
      }

      return message.channel.send(texto.slice(0, 1900));
    }

    // 🔒 restart
    if (cmd === "restart") {
      if (!isOwner) return message.reply("Sem permissão.");
      await message.reply("Reiniciando...");
      process.exit(0);
    }

    // 🔒 status
    if (cmd === "status" || cmd === "ping") {
      if (!isOwner) return message.reply("Sem permissão.");

      const sent = await message.reply("Calculando...");
      const latency = sent.createdTimestamp - message.createdTimestamp;
      const apiPing = Math.round(client.ws.ping);

      const uptime = process.uptime();
      const h = Math.floor(uptime / 3600);
      const m = Math.floor((uptime % 3600) / 60);
      const s = Math.floor(uptime % 60);

      const { count } = await supabase
        .from("followers")
        .select("*", { count: "exact", head: true });

      return sent.edit(
`📊 Status

Latência: ${latency}ms
API: ${apiPing}ms
Uptime: ${h}h ${m}m ${s}s
Registros: ${count || 0}`
      );
    }

    // 🔥 seguir
    if (cmd === "seguir") {
      const nomeOriginal = args.join(" ").trim();
      if (!nomeOriginal) {
        return message.reply("Comando não reconhecido ou não existe.");
      }

      const nome = normalizar(nomeOriginal);
      await seguir(userId, nome);
      addLog(`[SEGUIR] ${userId} -> ${nome}`);
      return message.reply(`Seguindo: ${nomeOriginal}`);
    }

    // 🔥 parar
    if (cmd === "parar") {
      const nomeOriginal = args.join(" ").trim();
      if (!nomeOriginal) {
        return message.reply("Comando não reconhecido ou não existe.");
      }

      const nome = normalizar(nomeOriginal);
      await parar(userId, nome);
      addLog(`[PARAR] ${userId} -X-> ${nome}`);
      return message.reply(`Parou: ${nomeOriginal}`);
    }

    return message.reply("Comando não reconhecido ou não existe.");

  } catch (err) {
    addLog("[CRASH] " + err.message);
    message.reply("Erro interno.");
  }

});

// 🔥 WEBHOOK
client.on("messageCreate", async (message) => {

  if (!message.webhookId) return;

  const content = message.content;
  addLog("[WEBHOOK] recebido");

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