import { Template } from '../types/types';
import { 
	loadTemplates, 
	createDefaultTemplate, 
	templates, 
	getTemplates, 
	findTemplateById, 
	saveTemplateSettings, 
	duplicateTemplate,
	getEditingTemplateIndex, // Add this import
	deleteTemplate // Add this import
} from '../managers/template-manager';
import { updateTemplateList, showTemplateEditor, resetUnsavedChanges, initializeAddPropertyButton } from '../managers/template-ui';
import { initializeGeneralSettings } from '../managers/general-settings';
import { initializeDragAndDrop, handleTemplateDrag } from '../utils/drag-and-drop';
import { initializeAutoSave } from '../utils/auto-save';
import { exportTemplate, importTemplate, initializeDropZone } from '../utils/import-export';
import { createIcons } from 'lucide';
import { icons } from '../icons/icons';
import { showGeneralSettings } from '../managers/general-settings-ui';
import { updateUrl } from '../utils/routing';
import browser from '../utils/browser-polyfill';
import { addBrowserClassToHtml } from '../utils/browser-detection';

document.addEventListener('DOMContentLoaded', async () => {
	const newTemplateBtn = document.getElementById('new-template-btn') as HTMLButtonElement;
	const exportTemplateBtn = document.getElementById('export-template-btn') as HTMLButtonElement;
	const importTemplateBtn = document.getElementById('import-template-btn') as HTMLButtonElement;
	const resetDefaultTemplateBtn = document.getElementById('reset-default-template-btn') as HTMLButtonElement;
	const duplicateTemplateBtn = document.getElementById('duplicate-template-btn') as HTMLElement;
	const deleteTemplateBtn = document.getElementById('delete-template-btn') as HTMLElement;
	const moreActionsBtn = document.getElementById('more-actions-btn') as HTMLButtonElement;
	const menu = document.querySelector('.menu-btn') as HTMLElement;

	async function initializeSettings(): Promise<void> {
		await initializeGeneralSettings();
		const loadedTemplates = await loadTemplates();
		updateTemplateList(loadedTemplates);
		initializeTemplateListeners();
		await handleUrlParameters();
		initializeSidebar();
		initializeAutoSave();

		exportTemplateBtn.addEventListener('click', exportTemplate);
		importTemplateBtn.addEventListener('click', importTemplate);
		resetDefaultTemplateBtn.addEventListener('click', resetDefaultTemplate);

		createIcons({ icons });
	}

	function initializeTemplateListeners(): void {
		const templateList = document.getElementById('template-list');
		if (templateList) {
			templateList.addEventListener('click', (event) => {
				const target = event.target as HTMLElement;
				const listItem = target.closest('li');
				if (listItem && listItem.dataset.id) {
					const currentTemplates = getTemplates();
					const selectedTemplate = currentTemplates.find((t: Template) => t.id === listItem.dataset.id);
					if (selectedTemplate) {
						resetUnsavedChanges();
						showTemplateEditor(selectedTemplate);
						updateUrl('templates', selectedTemplate.id);
					}
				}
			});
		} else {
			console.error('Template list not found');
		}

		if (newTemplateBtn) {
			newTemplateBtn.addEventListener('click', () => {
				showTemplateEditor(null);
			});
		}

		if (duplicateTemplateBtn) {
			duplicateTemplateBtn.addEventListener('click', () => {
				menu.classList.remove('show');
				const editingTemplateIndex = getEditingTemplateIndex();
				if (editingTemplateIndex !== -1) {
					const currentTemplate = templates[editingTemplateIndex];
					const newTemplate = duplicateTemplate(currentTemplate.id);
					saveTemplateSettings().then(() => {
						updateTemplateList();
						showTemplateEditor(newTemplate);
						updateUrl('templates', newTemplate.id);
					}).catch(error => {
						console.error('Failed to duplicate template:', error);
						alert('Failed to duplicate template. Please try again.');
					});
				}
			});
		}

		if (deleteTemplateBtn) {
			deleteTemplateBtn.addEventListener('click', () => {
				menu.classList.remove('show');
				const editingTemplateIndex = getEditingTemplateIndex();
				if (editingTemplateIndex !== -1) {
					const currentTemplate = templates[editingTemplateIndex];
					if (confirm(`Are you sure you want to delete the template "${currentTemplate.name}"?`)) {
						deleteTemplate(currentTemplate.id);
						saveTemplateSettings().then(() => {
							updateTemplateList();
							if (templates.length > 0) {
								showTemplateEditor(templates[0]);
							} else {
								showGeneralSettings();
							}
						}).catch(error => {
							console.error('Failed to delete template:', error);
							alert('Failed to delete template. Please try again.');
						});
					}
				}
			});
		}

		if (moreActionsBtn) {
			moreActionsBtn.addEventListener('click', (event) => {
				event.stopPropagation(); // Prevent this click from immediately closing the dropdown
				menu.classList.toggle('show');
			});
		}

		// Close the menu when clicking outside of it
		document.addEventListener('click', (event) => {
			if (!menu.contains(event.target as Node)) {
				menu.classList.remove('show');
			}
		});
	}

	async function handleUrlParameters(): Promise<void> {
		const urlParams = new URLSearchParams(window.location.search);
		const section = urlParams.get('section');
		const templateId = urlParams.get('template');

		if (section === 'general') {
			showGeneralSettings();
		} else if (templateId) {
			const template = findTemplateById(templateId);
			if (template) {
				showTemplateEditor(template);
			} else {
				console.error(`Template with id ${templateId} not found`);
				showGeneralSettings();
			}
		} else {
			showGeneralSettings();
		}
	}

	function resetDefaultTemplate(): void {
		const defaultTemplate = createDefaultTemplate();
		const currentTemplates = getTemplates();
		const defaultIndex = currentTemplates.findIndex((t: Template) => t.name === 'Default');
		
		if (defaultIndex !== -1) {
			currentTemplates[defaultIndex] = defaultTemplate;
		} else {
			currentTemplates.unshift(defaultTemplate);
		}

		saveTemplateSettings().then(() => {
			updateTemplateList();
			showTemplateEditor(defaultTemplate);
		}).catch(error => {
			console.error('Failed to reset default template:', error);
			alert('Failed to reset default template. Please try again.');
		});
	}

	function initializeSidebar(): void {
		const sidebarItems = document.querySelectorAll('#sidebar li[data-section], #template-list li');
		const sections = document.querySelectorAll('.settings-section');
		const sidebar = document.getElementById('sidebar');
		const settingsContainer = document.getElementById('settings');

		if (sidebar) {
			sidebar.addEventListener('click', (event) => {
				const target = event.target as HTMLElement;
				if (target.dataset.section === 'general') {
					showGeneralSettings();
				}
				if (settingsContainer) {
					settingsContainer.classList.remove('sidebar-open');
				}
			});
		}

		sidebarItems.forEach(item => {
			item.addEventListener('click', () => {
				const sectionId = (item as HTMLElement).dataset.section;
				sidebarItems.forEach(i => i.classList.remove('active'));
				item.classList.add('active');
				document.querySelectorAll('#template-list li').forEach(templateItem => templateItem.classList.remove('active'));
				const templateEditor = document.getElementById('template-editor');
				if (templateEditor) {
					templateEditor.style.display = 'none';
				}
				sections.forEach(section => {
					if (section.id === `${sectionId}-section`) {
						(section as HTMLElement).style.display = 'block';
						section.classList.add('active');
					} else {
						(section as HTMLElement).style.display = 'none';
						section.classList.remove('active');
					}
				});
				if (settingsContainer) {
					settingsContainer.classList.remove('sidebar-open');
				}
			});
		});

		const hamburgerMenu = document.getElementById('hamburger-menu');

		if (hamburgerMenu && settingsContainer) {
			hamburgerMenu.addEventListener('click', () => {
				settingsContainer.classList.toggle('sidebar-open');
				hamburgerMenu.classList.toggle('is-active');
			});
		}
	}

	const templateForm = document.getElementById('template-settings-form');
	if (templateForm) {
		initializeAutoSave();
		initializeDragAndDrop();
		initializeDropZone();
		initializeAddPropertyButton();
		handleTemplateDrag();
	}
	await addBrowserClassToHtml();
	await initializeSettings();
});