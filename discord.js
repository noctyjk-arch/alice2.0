const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const PREFIX = "!";
const DB_FILE = "./db.json";

// carrega banco
let db = {};
if (fs.existsSync(DB_FILE)) {
  db = JSON.parse(fs.readFileSync(DB_FILE));
}

console.log("DB carregado:", db);

// salva banco
function salvarDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// log de erro global
process.on("unhandledRejection", err => {
  console.log("ERRO NÃO TRATADO:", err);
});

client.on("ready", () => {
  console.log("Bot online");
});

// comandos
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(" ");
  const cmd = args.shift().toLowerCase();
  const userId = message.author.id;

  // 🔥 STATUS / PING
  if (cmd === "status" || cmd === "ping") {

    const sent = await message.reply("Calculando...");

    const latency = sent.createdTimestamp - message.createdTimestamp;
    const apiPing = Math.round(client.ws.ping);

    const uptime = process.uptime();
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = Math.floor(uptime % 60);

    await sent.edit(
`📊 Status do Bot

⏱️ Latência: ${latency}ms
🌐 API Ping: ${apiPing}ms
⏳ Uptime: ${h}h ${m}m ${s}s
👥 Usuários no banco: ${Object.keys(db).length}`
    );

    console.log("[STATUS CONSULTADO]");
    return;
  }

  // 🔥 BANCO
  if (cmd === "banco") {

    if (Object.keys(db).length === 0) {
      return message.reply("Banco vazio.");
    }

    let linhas = [];

    for (const [userId, obras] of Object.entries(db)) {
      linhas.push(`<@${userId}> → ${obras.join(", ")}`);
    }

    const limite = 1900;
    let atual = "📂 Banco de Dados:\n\n";

    for (const linha of linhas) {
      if ((atual + linha + "\n").length > limite) {
        await message.channel.send(atual);
        atual = "";
      }
      atual += linha + "\n";
    }

    if (atual.length > 0) {
      await message.channel.send(atual);
    }

    console.log("[BANCO CONSULTADO]");
    return;
  }

  // comandos com nome
  const nomeOriginal = args.join(" ").trim();
  if (!nomeOriginal) return message.reply("Informe o nome da obra.");

  const nome = nomeOriginal.toLowerCase();

  if (!db[userId]) db[userId] = [];

  if (cmd === "seguir") {
    if (!db[userId].includes(nome)) {
      db[userId].push(nome);
      salvarDB();
      console.log(`[SEGUIR] ${userId} -> ${nome}`);
    }

    message.reply(`agora você segue: ${nomeOriginal}`);
  }

  if (cmd === "parar") {
    db[userId] = db[userId].filter(o => o !== nome);
    salvarDB();

    console.log(`[PARAR] ${userId} -X-> ${nome}`);

    message.reply(`Você parou de seguir: ${nomeOriginal}`);
  }
});


// 🔥 webhook → ping automático
client.on("messageCreate", async (message) => {

  if (!message.webhookId) return;

  const content = message.content;

  console.log("[WEBHOOK RECEBIDO]");
  console.log(content);

  const match = content.match(/Obra:\s*(.+)/i);
  if (!match) {
    console.log("[ERRO] Não encontrou nome da obra");
    return;
  }

  const nomeOriginal = match[1].trim();
  const nome = nomeOriginal.toLowerCase();

  console.log("[OBRA DETECTADA]:", nome);

  // ✅ AGORA GUARDA IDS, NÃO STRING
  const seguidores = Object.entries(db)
    .filter(([id, obras]) => obras.includes(nome))
    .map(([id]) => id);

  console.log("[SEGUIDORES]:", seguidores);

  await message.delete();

  const chunkSize = 100;

  if (seguidores.length > 0) {
    for (let i = 0; i < seguidores.length; i += chunkSize) {
      const grupo = seguidores.slice(i, i + chunkSize);

      await message.channel.send({
        content: `${grupo.map(id => `<@${id}>`).join(" ")} 📢 Atualização`,
        allowedMentions: {
          users: grupo
        },
        embeds: [{
          description: content,
          color: 0xff69b4
        }]
      });
    }

    console.log(`[ENVIO] ${nomeOriginal} -> ${seguidores.length} usuários`);
  } else {
    await message.channel.send({
      content: `📢 Atualização`,
      embeds: [{
        description: content,
        color: 0xff69b4
      }]
    });

    console.log(`[ENVIO] ${nomeOriginal} -> ninguém segue`);
  }
});

client.login(process.env.TOKEN);