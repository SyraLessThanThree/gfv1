export default class BasicRoll extends Roll {
  constructor({ heat = 0, mod = 0, item }) {
    super("@heat+2d6+@mod", { heat, mod });
    this.heat = heat;
    this.mod = mod;
    if (item) {
      this.item = item;
    } else {
      this.adhoc = true;
      this.item = {
        system: {
          med: game.i18n.localize("GFv1.roll.med"),
          high: game.i18n.localize("GFv1.roll.high"),
          low: game.i18n.localize("GFv1.roll.low"),
        },
      };
    }
  }

  get resultType() {
    if (!this._evaluated) return;

    if (this.total < 8) return "low";
    if (this.total > 10) return "high";
    return "med";
  }

  get diceResults() {
    if (!this._evaluated) return;

    return this.dice[0].results.map((d) => d.result);
  }

  async show3dDice(results){
	const data = {
		throws: [
			{
				dice: [
					{
						result: results[0],
						resultLabel: results[0],
						type: 'd6',
						vectors: [],
						options: {}
					},
					{
						result: results[1],
						resultLabel: results[1],
						type: 'd6',
						vectors: [],
						options: {}
					},
				]
			}
		]
	};
	await game.dice3d.show(data);
  }

  async toMessage(actor) {
    if (!this._evaluated) await this.evaluate();
    if(game.dice3d) await this.show3dDice(this.diceResults);
    const description = await this.item.enrichedDescription(false);
    const chatData = {
      speaker: ChatMessage.getSpeaker({ actor }),
      sound: CONFIG.sounds.dice,
      content: await renderTemplate(
        "systems/gfv1/templates/chat/basic-roll.hbs",
        {
          roll: {
            total: this.total,
            heat: this.heat,
            d1: this.diceResults[0],
            d2: this.diceResults[1],
            mod: this.mod,
            result: this.resultType,
          },
          item: this.item,
          description,
        },
      ),
      roll: this,
    };

    return ChatMessage.create(chatData);
  }
}
