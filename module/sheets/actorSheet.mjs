import DialogHelper from "../util/dialogHelper.mjs";
import DocumentHelper from "../util/documentHelper.mjs";
import DragDropHandler from "../util/dragDrop.mjs";
import Gfv1Error from "../util/error.mjs";
import Tabs from "../util/tabs.mjs";
import { embraceTag } from "./elements/itemControl.mjs";

const HandlebarsApplicationMixin =
  foundry.applications.api.HandlebarsApplicationMixin;
const ActorSheetV2 = foundry.applications.sheets.ActorSheetV2;

export default class Gfv1ActorSheet extends HandlebarsApplicationMixin(
  ActorSheetV2,
) {
  static ACTIONS = {};
  static TABS = []; // ids of tabs used by sheet

  static get DEFAULT_OPTIONS() {
    let actions = {
		editImage: this._onEditImage,
		createDoc: this._createDoc,
		viewDoc: DocumentHelper.viewDoc,
		deleteDoc: DocumentHelper.deleteDoc,
		makeRoll: this._roll,
		toggleEdit: this._toggleEdit,
		embraceTag: this._embraceTag,
	  }
    return {
      tag: "form",
      classes: ["gfv1", "sheet", "actor-sheet"],
      actions,
      form: {
        submitOnChange: true,
        closeOnSubmit: false,
      },
      window: {
        resizable: true,
      },
      position: {
        width: 600,
        height: 800,
      },
    };
  }

  static get PARTS() {
    return {
      header: {
        template: "systems/gfv1/templates/actor/header.hbs",
      },
      basicInfo: {
        template: "systems/gfv1/templates/actor/basic-info.hbs",
      },
      ...Tabs.templates(this.TABS),
    };
  }

  get title() {
	  let pronouns = this.actor.system?.pronouns;
	  let legalPronouns = this.actor.system?.legalPronouns;
	  let preferredPronouns = this.actor.system?.preferredPronouns;
    if (pronouns) {
      return `${this.actor.name} (${pronouns})`;
    } else if (legalPronouns && preferredPronouns){
      return `${this.actor.name} (${legalPronouns}(${preferredPronouns}))`;
    } else if (legalPronouns || preferredPronouns){
      return `${this.actor.name} (${legalPronouns ?? preferredPronouns})`;
    }
    return this.actor.name;
  }

  _locked = true;
  tabGroups = {};

  /** @override */
  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    options.parts = ["header", "basicInfo", "tabs"];

    if (this.document.limited) this.tabs.limitTabsTo(["description", "actor"]);

    this.tabs.ids.forEach((id) => {
      options.parts.push(id);
    });
  }

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    await this.document.system.prepareContext(context);

    context.locked = this._locked;
    context.editable = this.isEditable;

    context.description = await this.document.enrichedDescription(
      this.document.isOwner,
    );

    context.fields = this.document.schema.fields;
    context.systemFields = this.document.system.schema.fields;

    context.tabs = this.tabs.contextData(this.tabGroups);
    return context;
  }

  async _preparePartContext(partId, context) {
    context.tab = context.tabs[partId];
    return context;
  }

  /** @inheritdoc */
  _onRender(context, options) {
    super._onRender();

    this.element.querySelectorAll(".item-input").forEach((d) => {
      d.addEventListener("change", DocumentHelper.onResourceChange.bind(this));
    });

    new DragDropHandler(this, {
      item: this._onDropItems,
      internal: this._onItemSort,
    });
  }

  async _onItemSort({ sourceElement, targetElement, sortBefore }) {
    const source = await DocumentHelper.getItemFromHtml(sourceElement);
    const target = await DocumentHelper.getItemFromHtml(targetElement);
    const siblings = this.actor.itemTypes[source.type];
    return await source.sortRelative({
      target,
      siblings,
      sortBefore,
    });
  }

  async _onDropItems(items) {
    if (items.length === 1 && items[0].type === "playbook") {
      return this._importPlaybook(items[0]);
    }
    try {
      return await this.actor.system.addItems(items);
    } catch (error) {
      if (!(error instanceof Gfv1Error)) {
        throw error;
      }
      ui.notifications.error(error.originMessage);
    }
  }

  async _importPlaybook(playbook) {
    const itemTypes = await playbook.system.getItemTypes();
    const identities = await DialogHelper.selectImport({
      items: itemTypes.identity,
      type: "identities",
      preSelect: (identity) => true,
    });
    if (identities === undefined) return;

    const assets = await DialogHelper.selectImport({
      items: itemTypes.asset,
      type: "assets",
      preSelect: (asset) => asset.system.inLimit === false,
    });
    if (assets === undefined) return;

    const bonds = await DialogHelper.selectImport({
      items: itemTypes.bond,
      type: "bonds",
      preSelect: (bond) => bond.system.level !== "npc",
    });
    if (bonds === undefined) return;

    const rules = await DialogHelper.selectImport({
      items: itemTypes.rule,
      type: "rules",
      preSelect: (rule) => !rule.system.locked,
    });
    if (rules === undefined) return;

    const strains = await DialogHelper.selectImport({
      items: itemTypes.strain,
      type: "strains",
      preSelect: (rule) => !rule.system.locked,
    });
    if (strains === undefined) return;

    return this.actor.importPlaybook(playbook, [
      ...identities,
      ...assets,
      ...bonds,
      ...rules,
      ...strains,
    ]);
  }

  /**
   * Actions
   */

  /**
   * Handle changing a Document's image.
   * @this Gfv1ActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise}
   * @protected
   */
  static async _onEditImage(event, target) {
    if (target.nodeName !== "IMG") {
      throw new Gfv1Error(
        "The editImage action is available only for IMG elements.",
      );
    }
    const attr = target.dataset.edit;
    const current = foundry.utils.getProperty(this.document._source, attr);
    const defaultArtwork =
      this.document.constructor.getDefaultArtwork?.(this.document._source) ??
      {};
    const defaultImage = foundry.utils.getProperty(defaultArtwork, attr);
    const fp = new FilePicker({
      current,
      type: "image",
      redirectToRoot: defaultImage ? [defaultImage] : [],
      callback: (path) => {
        target.src = path;

        return this.document.update({ [target.dataset.edit]: path });
      },
      top: this.position.top + 40,
      left: this.position.left + 10,
    });
    await fp.browse();
  }

  /**
   * Handle creating a new Owned Item or ActiveEffect for the actor using initial data defined in the HTML dataset
   *
   * @this Gfv1ActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @private
   */
  static async _createDoc(event, target) {
    // Prepare the document creation data by initializing it a default name.
    const docData = {
      name: Item.defaultName({
        // defaultName handles an undefined type gracefully
        type: target.dataset.type,
        parent: this.actor,
      }),
    };
    // Loop through the dataset and add it to our docData
    for (const [dataKey, value] of Object.entries(target.dataset)) {
      if (["action", "documentClass"].includes(dataKey)) continue;
      foundry.utils.setProperty(docData, dataKey, value);
    }

    // Finally, create the embedded document!
    return Item.create(docData, { parent: this.actor });
  }

  static _toggleEdit(event, target) {
    event.preventDefault();
    this._locked = !this._locked;
    this.render(false);
  }

  /**
   * Handle embracing a tag as an identity
   *
   * @this Gfv1ActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @private
   */
  static async _embraceTag(event, target) {
    const doc = await DocumentHelper.getItemFromHtml(target, this.actor.items);
    if (event.shiftKey) return this.actor.embraceTag(doc);

    if (await DialogHelper.confirmAdopt()) {
      this.actor.embraceTag(doc);
    }
  }

  /**
   * handles rolling
   *
   * @this Gfv1ActorSheet
   * @param {pointerevent} event   the originating click event
   * @param {htmlelement} target   the capturing html element which defined a [data-action]
   * @protected
   */
  static async _roll(event, target) {
    if (target.dataset.noItem !== undefined) {
      return DialogHelper.rollModifierQuery({ actor: this.actor });
    }
    const item = await DocumentHelper.getItemFromHtml(target);
    DialogHelper.rollModifierQuery({ actor: this.actor, item });
  }
}
