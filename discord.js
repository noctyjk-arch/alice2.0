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

console.log("Bot iniciando...");

process.on("unhandledRejection", err => {
  console.log("ERRO NÃO TRATADO:", err);
});

client.on("ready", () => {
  console.log("Bot online");
});

// 🔥 HELPERS SUPABASE
async function getSeguidores(nome) {
  const { data } = await supabase
    .from("followers")
    .select("user_id")
    .eq("obra", nome);

  return data ? data.map(u => u.user_id) : [];
}

async function seguir(userId, nome) {
  await supabase.from("followers").insert([
    { user_id: userId, obra: nome }
  ]);
}

async function parar(userId, nome) {
  await supabase
    .from("followers")
    .delete()
    .eq("user_id", userId)
    .eq("obra", nome);
}

// 🔥 BOT PRINCIPAL
client.on("messageCreate", async (message) => {

  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(" ");
  const cmd = args.shift().toLowerCase();
  const userId = message.author.id;

  const isOwner = userId === OWNER_ID;

  // 🔒 RESTART
  if (cmd === "restart") {
    if (!isOwner) return message.reply("Sem permissão.");

    await message.reply("Reiniciando...");
    process.exit(0);
  }

  // 🔒 STATUS
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
`📊 Status do Bot

⏱️ Latência: ${latency}ms
🌐 API Ping: ${apiPing}ms
⏳ Uptime: ${h}h ${m}m ${s}s
👥 Registros no banco: ${count || 0}`
    );
  }

  // 🔒 BANCO
  if (cmd === "banco") {
    if (!isOwner) return message.reply("Sem permissão.");

    const { data } = await supabase
      .from("followers")
      .select("user_id, obra");

    if (!data || data.length === 0) {
      return message.reply("Banco vazio.");
    }

    const map = {};

    for (const row of data) {
      if (!map[row.user_id]) map[row.user_id] = [];
      map[row.user_id].push(row.obra);
    }

    let linhas = [];

    for (const [uid, obras] of Object.entries(map)) {
      linhas.push(`<@${uid}> → ${obras.join(", ")}`);
    }

    let atual = "📂 Banco de Dados:\n\n";

    for (const linha of linhas) {
      if ((atual + linha + "\n").length > 1900) {
        await message.channel.send(atual);
        atual = "";
      }
      atual += linha + "\n";
    }

    if (atual.length > 0) {
      await message.channel.send(atual);
    }

    return;
  }

  // 🔥 seguir / parar (público)
  const nomeOriginal = args.join(" ").trim();
  if (!nomeOriginal) return message.reply("Informe o nome da obra.");

  const nome = nomeOriginal.toLowerCase();

  if (cmd === "seguir") {
    await seguir(userId, nome);
    return message.reply(`agora você segue: ${nomeOriginal}`);
  }

  if (cmd === "parar") {
    await parar(userId, nome);
    return message.reply(`Você parou de seguir: ${nomeOriginal}`);
  }
});

// 🔥 WEBHOOK
client.on("messageCreate", async (message) => {

  if (!message.webhookId) return;

  const content = message.content;

  const match = content.match(/Obra:\s*(.+)/i);
  if (!match) return;

  const nomeOriginal = match[1].trim();
  const nome = nomeOriginal.toLowerCase();

  const seguidores = await getSeguidores(nome);

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

  } else {
    await message.channel.send({
      content: "📢 Atualização",
      embeds: [{
        description: content,
        color: 0xff69b4
      }]
    });
  }
});

client.login(process.env.TOKEN);