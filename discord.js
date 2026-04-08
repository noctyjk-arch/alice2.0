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

// comandos (!seguir / !parar)
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(" ");
  const cmd = args.shift().toLowerCase();

  const nomeOriginal = args.join(" ").trim();
  if (!nomeOriginal) return message.reply("Informe o nome da obra.");

  const nome = nomeOriginal.toLowerCase();
  const userId = message.author.id;

  if (!db[userId]) db[userId] = [];

  if (cmd === "seguir") {

    if (!db[userId].includes(nome)) {
      db[userId].push(nome);
      salvarDB();
      console.log(`[SEGUIR] ${userId} -> ${nome}`);
    }

    message.reply(`Agora você segue: ${nomeOriginal}`);
  }

  if (cmd === "parar") {

    db[userId] = db[userId].filter(o => o !== nome);
    salvarDB();

    console.log(`[PARAR] ${userId} -X-> ${nome}`);

    message.reply(`Você parou de seguir: ${nomeOriginal}`);
  }
});


// 🔥 webhook → ping automático (SEM CARGOS)
client.on("messageCreate", async (message) => {

  if (!message.webhookId) return;

  const content = message.content;

  console.log("[WEBHOOK RECEBIDO]");
  console.log(content);

  // extrai nome da obra
  const match = content.match(/Obra:\s*(.+)/i);
  if (!match) {
    console.log("[ERRO] Não encontrou nome da obra");
    return;
  }

  const nomeOriginal = match[1].trim();
  const nome = nomeOriginal.toLowerCase();

  console.log("[OBRA DETECTADA]:", nome);

  // encontra seguidores
  const seguidores = Object.entries(db)
    .filter(([id, obras]) => obras.includes(nome))
    .map(([id]) => `<@${id}>`);

  console.log("[SEGUIDORES]:", seguidores);

  // apaga mensagem original do webhook
  await message.delete();

  // divide menções
  const chunkSize = 100;

  if (seguidores.length > 0) {
    for (let i = 0; i < seguidores.length; i += chunkSize) {
      const grupo = seguidores.slice(i, i + chunkSize);

      await message.channel.send({
        content: `${grupo.join(" ")} 📢 Atualização`,
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