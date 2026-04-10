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

  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(" ");
  const cmd = args.shift().toLowerCase();
  const userId = message.author.id;
  const isOwner = userId === OWNER_ID;

  // 🔒 restart
  if (cmd === "restart") {
    if (!isOwner) return message.reply("Sem permissão.");
    await message.reply("Reiniciando...");
    process.exit(0);
  }

  // 🔒 status / ping
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

  // 🔒 banco
  if (cmd === "banco") {
    if (!isOwner) return message.reply("Sem permissão.");

    const { data } = await supabase.from("followers").select("user_id, obra");

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

  // 🔒 debug
  if (cmd === "debug") {
    if (!isOwner) return message.reply("Sem permissão.");
    return message.reply("Logs ativos: " + logs.length);
  }

  // 🔒 logs
  if (cmd === "logs") {
    if (!isOwner) return message.reply("Sem permissão.");
    return message.channel.send("```" + logs.join("\n") + "```");
  }

  // 🔒 erro
  if (cmd === "erro") {
    if (!isOwner) return message.reply("Sem permissão.");
    return message.reply(ultimoErro || "Sem erros.");
  }

  // 🔒 uptime
  if (cmd === "uptime") {
    if (!isOwner) return message.reply("Sem permissão.");
    const t = process.uptime();
    return message.reply(`Uptime: ${Math.floor(t)}s`);
  }

  // 🔥 minhas
  if (cmd === "minhas") {
    const { data } = await supabase
      .from("followers")
      .select("obra")
      .eq("user_id", userId);

    if (!data?.length) return message.reply("Você não segue nada.");

    return message.reply("Você segue:\n" + data.map(d => d.obra).join(", "));
  }

  // 🔥 limpar
  if (cmd === "limpar") {
    await supabase.from("followers").delete().eq("user_id", userId);
    return message.reply("Tudo removido.");
  }

  // 🔥 seguindo
  if (cmd === "seguindo") {
    const nome = args.join(" ").toLowerCase();

    const { data } = await supabase
      .from("followers")
      .select("user_id")
      .eq("obra", nome);

    return message.reply(`Seguidores: ${data?.length || 0}`);
  }

  // 🔥 top
  if (cmd === "top") {
    const { data } = await supabase.from("followers").select("obra");

    const count = {};
    data.forEach(r => {
      count[r.obra] = (count[r.obra] || 0) + 1;
    });

    const top = Object.entries(count)
      .sort((a,b) => b[1] - a[1])
      .slice(0, 5);

    return message.reply(
      "Top obras:\n" + top.map(([o,c]) => `${o} (${c})`).join("\n")
    );
  }

  // 🔥 seguir / parar
  const nomeOriginal = args.join(" ").trim();
  if (!nomeOriginal) return message.reply("Informe o nome.");

  const nome = nomeOriginal.toLowerCase();

  if (cmd === "seguir") {
    await seguir(userId, nome);
    addLog(`[SEGUIR] ${userId} -> ${nome}`);
    return message.reply(`Seguindo: ${nomeOriginal}`);
  }

  if (cmd === "parar") {
    await parar(userId, nome);
    addLog(`[PARAR] ${userId} -X-> ${nome}`);
    return message.reply(`Parou: ${nomeOriginal}`);
  }
});

// 🔥 WEBHOOK
client.on("messageCreate", async (message) => {

  if (!message.webhookId) return;

  const content = message.content;
  addLog("[WEBHOOK] recebido");

  const match = content.match(/Obra:\s*(.+)/i);
  if (!match) return;

  const nome = match[1].trim().toLowerCase();
  const seguidores = await getSeguidores(nome);

  await message.delete();

  if (seguidores.length > 0) {
    await message.channel.send({
      content: seguidores.map(id => `<@${id}>`).join(" ") + " 📢 Atualização",
      allowedMentions: { users: seguidores },
      embeds: [{ description: content }]
    });
    addLog(`[ENVIO] ${nome} -> ${seguidores.length}`);
  } else {
    await message.channel.send({
      content: "📢 Atualização",
      embeds: [{ description: content }]
    });
  }
});

client.login(process.env.TOKEN);