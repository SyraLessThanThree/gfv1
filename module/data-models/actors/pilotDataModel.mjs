import BaseActorDataModel from "../baseActorDataModel.mjs";
import Playbook from "../../sheets/elements/playbook.mjs";
import Gfv1Error from "../../util/error.mjs";

const { BooleanField, HTMLField, NumberField, StringField } =
  foundry.data.fields;

const schema = {
  description: new HTMLField(),
  permissions: new NumberField({ required: true, min: 0, initial: 0, step: 1 }),
  heat: new NumberField({ required: true, min: 0, initial: 0, step: 1 }),
  legalPronouns: new StringField({ required: true, initial: "it/its" }),
  preferredPronouns: new StringField({ required: true, initial: "" }),
  framePronouns: new StringField({ required: true, initial: "she/her" }),
  _framePlaybook: new StringField({ required: true, initial: "No Playbook" }),
  _pilotPlaybook: new StringField({ required: true, initial: "No Playbook" }),
};

export default class PilotDataModel extends BaseActorDataModel {
  static defineSchema() {
    return schema;
  }

  allowedPlaybookTypes = ["pilotPlaybook", "framePlaybook"];
  allowedItemTypes = ["tag", "identity", "bond", "rule", "asset"];

  get pilotPlaybook() {
    const playbook = new Playbook(this.parent, "pilotPlaybook", {
      rules: "rule",
      assets: "asset",
    });
    playbook.maxAssets = CONFIG.GFV1.maxAssets.pilot;
    return playbook;
  }

  get framePlaybook() {
    return new Playbook(this.parent, "framePlaybook");
  }

  async spendHeat(amount) {
    if (amount < 0) throw Gfv1Error("Cannot spend negative heat!");
    const doc = this.parent;
    const newHeat = doc.system.heat - amount;
    if (newHeat < 0) throw Gfv1Error("Spent too much heat!");
    return doc.update({ "system.heat": newHeat });
  }
}
