// Allergy Selector - Enhanced dropdown system for allergen and reaction selection
// Version: 1.0

const ALLERGY_DATA = {
  "Food Allergies": {
    "Peanuts": "Anaphylaxis, swelling, hives, vomiting, shortness of breath, wheezing",
    "Tree nuts (e.g., almonds, walnuts, cashews)": "Anaphylaxis, rash, hives, swelling, vomiting",
    "Milk": "Skin rash, hives, vomiting, diarrhea, constipation, stomach pain, flatulence, colitis, nasal congestion, dermatitis, blisters, migraine, anaphylaxis",
    "Eggs": "Anaphylaxis, swelling, flatulence, vomiting, hives",
    "Fish": "Respiratory reactions, anaphylaxis, oral allergy syndrome (itching/swelling in mouth), vomiting",
    "Shellfish (e.g., shrimp, crab, lobster)": "Respiratory symptoms, anaphylaxis, oral allergy syndrome, gastrointestinal issues, rhinitis, conjunctivitis",
    "Wheat": "Eczema, hives, asthma, hay fever, oral allergy syndrome, angioedema, abdominal cramps, celiac-like symptoms, diarrhea, nausea, vomiting, exercise-induced anaphylaxis",
    "Soy": "Anaphylaxis, asthma exacerbation, rhinitis, conjunctivitis, hives, atopic dermatitis, swelling, diarrhea, nausea, vomiting",
    "Sesame": "Respiratory, skin, and gastrointestinal reactions; serious anaphylaxis",
    "Mustard": "Eczema, rash, hives, facial swelling, oral allergy syndrome, conjunctivitis, wheezing, abdominal pain, diarrhea, nausea, vomiting, acid reflux, dizziness, asthma, chest pain, anaphylaxis",
    "Celery": "Abdominal pain, nausea, vomiting, oral allergy syndrome, urticaria, neck/facial swelling, severe asthma, exercise-induced anaphylaxis, anaphylactic shock",
    "Buckwheat": "Asthma, rhinitis, pruritus (itching), gastrointestinal disturbances, urticaria, angioedema, shock, anaphylaxis",
    "Fruit (e.g., apples, peaches in oral allergy syndrome)": "Mild itching, rash, urticaria, oral allergy syndrome, abdominal pain, vomiting, anaphylaxis",
    "Poultry meat": "Hives, swelling, nausea, vomiting, diarrhea, severe oral allergy syndrome, shortness of breath, anaphylactic shock",
    "Red meat (alpha-gal syndrome)": "Hives, swelling, dermatitis, stomach pain, nausea, vomiting, dizziness, fainting, shortness of breath, anaphylaxis",
    "Rice": "Sneezing, runny nose, itching, stomachache, eczema",
    "Maize (corn)": "Hives, pallor, confusion, dizziness, stomach pain, swelling, vomiting, indigestion, diarrhea, cough, throat tightness, wheezing, shortness of breath, anaphylaxis",
    "Oats": "Dermatitis, respiratory problems, anaphylaxis",
    "Garlic": "Dermatitis, rhinitis, asthma, urticaria, skin fissures/thickening, rarely anaphylaxis",
    "Sulfites (additives in wine, dried fruits)": "Hives, rash, skin redness, headache, burning eyes, asthma-like breathing difficulties, anaphylaxis",
    "Tartrazine (yellow food dye)": "Skin irritation, hives, rash"
  },
  "Drug/Medication Allergies": {
    "Penicillin and related antibiotics (e.g., amoxicillin)": "Diarrhea, hypersensitivity, nausea, rash, neurotoxicity, urticaria, hives, itchy skin, facial swelling, wheezing, anaphylaxis",
    "Cephalosporins": "Maculopapular/morbilliform rash, urticaria, eosinophilia, serum sickness-like reactions, anaphylaxis",
    "Sulfonamides (sulfa drugs)": "Urinary tract issues, blood disorders, porphyria, hypersensitivity, Stevens-Johnson syndrome, toxic epidermal necrolysis",
    "Non-steroidal anti-inflammatories (NSAIDs, e.g., aspirin, ibuprofen)": "Swollen eyes/lips/tongue, difficulty swallowing, shortness of breath, rapid heart rate, hives, asthma exacerbation",
    "Tetracycline": "Severe headache, dizziness, blurred vision, fever, chills, body aches, flu symptoms, blistering, peeling, dark urine",
    "Carbamazepine (Tegretol)": "Shortness of breath, wheezing, facial/lip/tongue swelling, hives",
    "Phenytoin (Dilantin)": "Swollen glands, bruising/bleeding, fever, sore throat",
    "Intravenous contrast dye": "Anaphylactoid reactions, hives, rash, wheezing",
    "Balsam of Peru (in some topicals)": "Redness, swelling, itching, contact dermatitis, stomatitis, cheilitis, pruritus, hand eczema, plantar dermatitis, rhinitis, conjunctivitis, blisters"
  },
  "Environmental/Airborne Allergies": {
    "Pollen (hay fever)": "Sneezing, itching (nose/eyes/mouth), runny/stuffy nose, fatigue, watery/red/swollen eyes, asphyxiation in severe cases",
    "Dust mites/excretion": "Asthma, coughing, sneezing, wheezing, watery eyes, sore throat, headache",
    "Mold spores/mildew": "Coughing, sneezing, poor breathing, wheezing, rash, watery eyes, sore throat, dry skin, headache; year-round symptoms",
    "Pet dander (from furred animals)": "Rash, sneezing, congestion, itching, watery eyes",
    "Cockroaches/mice": "Asthma, rhinitis, year-round allergy symptoms"
  },
  "Insect Allergies": {
    "Bee/wasp/hornet/yellow jacket/fire ant stings": "Pain, swelling at site, full-body itching/hives, skin flushing, cough, chest tightness, wheezing, shortness of breath, anaphylaxis",
    "Dust mites/cockroaches (non-stinging)": "Asthma, rhinitis, congestion, sneezing"
  },
  "Contact/Skin Allergies": {
    "Latex (in gloves, balloons)": "Contact dermatitis, hypersensitivity, itching, redness, hives; severe: anaphylaxis",
    "Nickel (in jewelry, coins)": "Localized/widespread dermatitis, headache, fatigue, respiratory issues, fever, vertigo, nausea, vomiting, diarrhea",
    "Balsam of Peru (in perfumes, cosmetics)": "Redness, swelling, itching, contact dermatitis, stomatitis, cheilitis, pruritus, hand/foot eczema, rhinitis, conjunctivitis, blisters",
    "Chromium": "Dry/cracked/scaly skin, crusts, papules, erythema, pain, burning, pruritus",
    "Cobalt chloride": "Eczema, rash",
    "Gold sodium thiosulfate": "Papular itchy eruptions, erythema, dermal papules, vesicles, scaling patches",
    "Quaternium-15 (preservative in cosmetics)": "Contact dermatitis, pruritus, erythema, scaly plaques; eye exposure: corneal issues"
  },
  "General Types of Allergic Reactions": {
    "Mild/Moderate": "Hives (urticaria), rash, itching (pruritus), eczema (atopic dermatitis), sneezing, runny/stuffy nose, watery/itchy eyes, oral allergy syndrome (mouth tingling/itching)",
    "Respiratory": "Asthma, wheezing, shortness of breath, rhinitis, conjunctivitis, cough, chest tightness",
    "Gastrointestinal": "Abdominal pain, nausea, vomiting, diarrhea, flatulence",
    "Severe (Anaphylaxis)": "Swelling (angioedema, especially lips/tongue/throat), drop in blood pressure, rapid/weak pulse, dizziness, fainting, sense of doom, shock; requires immediate epinephrine",
    "Other/Delayed": "Stevens-Johnson syndrome, toxic epidermal necrolysis (rare, severe skin reactions), serum sickness, eosinophilia, neurotoxicity, migraine"
  }
};

// Common reactions that can be selected independently
const COMMON_REACTIONS = [
  "Anaphylaxis",
  "Hives (urticaria)",
  "Swelling (angioedema)",
  "Rash",
  "Itching (pruritus)",
  "Eczema",
  "Sneezing",
  "Runny nose",
  "Watery eyes",
  "Asthma",
  "Wheezing",
  "Shortness of breath",
  "Nausea",
  "Vomiting",
  "Diarrhea",
  "Abdominal pain",
  "Dizziness",
  "Fainting",
  "Chest tightness",
  "Facial swelling",
  "Tongue swelling",
  "Throat swelling",
  "Difficulty swallowing",
  "Rapid heart rate",
  "Low blood pressure",
  "Skin redness",
  "Contact dermatitis",
  "Oral allergy syndrome",
  "Exercise-induced anaphylaxis"
];

// Create allergy selector
function createAllergySelector(containerId, allergenFieldId, reactionFieldId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('Allergy selector container not found:', containerId);
    return;
  }

  // Create the enhanced allergy selection interface
  container.innerHTML = `
    <div class="allergy-selector-container" style="background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6; margin-bottom: 15px;">
      <h5 style="margin-top: 0; color: #495057; margin-bottom: 15px;">🔍 Enhanced Allergy Selection</h5>
      
      <!-- Category Selection -->
      <div style="margin-bottom: 15px;">
        <label style="display: block; font-weight: bold; margin-bottom: 5px; color: #495057;">Category:</label>
        <select id="${containerId}-category" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;">
          <option value="">Select a category...</option>
          ${Object.keys(ALLERGY_DATA).map(category => `<option value="${category}">${category}</option>`).join('')}
        </select>
      </div>

      <!-- Allergen Selection -->
      <div style="margin-bottom: 15px;">
        <label style="display: block; font-weight: bold; margin-bottom: 5px; color: #495057;">Allergen:</label>
        <select id="${containerId}-allergen" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;">
          <option value="">Select an allergen...</option>
        </select>
      </div>

      <!-- Reaction Selection -->
      <div style="margin-bottom: 15px;">
        <label style="display: block; font-weight: bold; margin-bottom: 5px; color: #495057;">Common Reactions:</label>
        <div id="${containerId}-reactions" style="max-height: 150px; overflow-y: auto; border: 1px solid #ccc; border-radius: 4px; padding: 8px; background: white;">
          <!-- Reactions will be populated here -->
        </div>
      </div>

      <!-- Severity Selection -->
      <div style="margin-bottom: 15px;">
        <label style="display: block; font-weight: bold; margin-bottom: 5px; color: #495057;">Severity:</label>
        <select id="${containerId}-severity" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;">
          <option value="">Select severity...</option>
          <option value="Mild">Mild - Minor symptoms, no immediate danger</option>
          <option value="Moderate">Moderate - Noticeable symptoms, may require treatment</option>
          <option value="Severe">Severe - Significant symptoms, requires immediate attention</option>
          <option value="Life-threatening">Life-threatening - Anaphylaxis or severe systemic reaction</option>
        </select>
      </div>

      <!-- Manual Entry Options -->
      <div style="margin-bottom: 15px;">
        <label style="display: block; font-weight: bold; margin-bottom: 5px; color: #495057;">Or enter manually:</label>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div>
            <input type="text" id="${containerId}-manual-allergen" placeholder="Custom allergen..." 
                   style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;">
          </div>
          <div>
            <input type="text" id="${containerId}-manual-reaction" placeholder="Custom reaction..." 
                   style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;">
          </div>
        </div>
      </div>

      <!-- Selected Values Display -->
      <div style="margin-bottom: 15px;">
        <label style="display: block; font-weight: bold; margin-bottom: 5px; color: #495057;">Selected:</label>
        <div id="${containerId}-selected" style="background: white; padding: 10px; border: 1px solid #ddd; border-radius: 4px; min-height: 40px; font-size: 14px;">
          <em style="color: #666;">No selection made</em>
        </div>
      </div>

      <!-- Notes Field -->
      <div style="margin-bottom: 15px;">
        <label for="${containerId}-notes" style="display: block; font-weight: bold; margin-bottom: 5px; color: #495057;">Notes:</label>
        <input type="text" id="${containerId}-notes" placeholder="Additional notes..." 
               style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;">
      </div>

      <!-- Action Buttons -->
      <div style="display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap;">
        <button type="button" id="${containerId}-cancel" style="background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px; display: none;">
          Cancel
        </button>
        <button type="button" id="${containerId}-clear" style="background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">
          Clear Selection
        </button>
        <button type="button" id="${containerId}-apply" style="background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">
          Add to Allergies Table
        </button>
      </div>
    </div>
  `;

  // Initialize the selector
  initializeAllergySelector(containerId, allergenFieldId, reactionFieldId);
}

function initializeAllergySelector(containerId, allergenFieldId, reactionFieldId) {
  console.log('Initializing allergy selector:', { containerId, allergenFieldId, reactionFieldId });
  
  const categorySelect = document.getElementById(`${containerId}-category`);
  const allergenSelect = document.getElementById(`${containerId}-allergen`);
  const reactionsContainer = document.getElementById(`${containerId}-reactions`);
  const severitySelect = document.getElementById(`${containerId}-severity`);
  const manualAllergenInput = document.getElementById(`${containerId}-manual-allergen`);
  const manualReactionInput = document.getElementById(`${containerId}-manual-reaction`);
  const notesInput = document.getElementById(`${containerId}-notes`);
  const selectedDisplay = document.getElementById(`${containerId}-selected`);
  const cancelBtn = document.getElementById(`${containerId}-cancel`);
  const clearBtn = document.getElementById(`${containerId}-clear`);
  const applyBtn = document.getElementById(`${containerId}-apply`);
  const categoryField = document.getElementById(containerId.includes('clinical-note') ? 'note-allergy-category' : 'allergy-category');
  
  // Debug: Check if all elements are found
  console.log('Allergy selector elements found:', {
    categorySelect: !!categorySelect,
    allergenSelect: !!allergenSelect,
    reactionsContainer: !!reactionsContainer,
    severitySelect: !!severitySelect,
    manualAllergenInput: !!manualAllergenInput,
    manualReactionInput: !!manualReactionInput,
    notesInput: !!notesInput,
    selectedDisplay: !!selectedDisplay,
    cancelBtn: !!cancelBtn,
    clearBtn: !!clearBtn,
    applyBtn: !!applyBtn
  });
  
  if (!applyBtn) {
    console.error('Apply button not found! Looking for:', `${containerId}-apply`);
    return;
  }

  let selectedReactions = [];
  let selectedAllergen = '';
  let selectedCategory = '';
  let selectedSeverity = '';

  // Populate common reactions
  function populateCommonReactions() {
    reactionsContainer.innerHTML = COMMON_REACTIONS.map(reaction => `
      <label style="display: block; margin-bottom: 5px; cursor: pointer; font-size: 13px;">
        <input type="checkbox" value="${reaction}" style="margin-right: 8px;">
        ${reaction}
      </label>
    `).join('');
  }

  function populateAllergenDropdown(category) {
    allergenSelect.innerHTML = '<option value="">Select an allergen...</option>';

    if (category && ALLERGY_DATA[category]) {
      Object.keys(ALLERGY_DATA[category]).forEach(allergen => {
        const option = document.createElement('option');
        option.value = allergen;
        option.textContent = allergen;
        option.dataset.category = category;
        allergenSelect.appendChild(option);
      });
      return;
    }

    // No category selected: show all allergens with category hint
    Object.keys(ALLERGY_DATA).forEach(cat => {
      Object.keys(ALLERGY_DATA[cat]).forEach(allergen => {
        const option = document.createElement('option');
        option.value = allergen;
        option.textContent = `${allergen} (${cat})`;
        option.dataset.category = cat;
        allergenSelect.appendChild(option);
      });
    });
  }

  // Handle category change
  categorySelect.addEventListener('change', function() {
    selectedCategory = this.value;
    selectedAllergen = '';
    
    // Clear and populate allergen dropdown
    populateAllergenDropdown(selectedCategory);
    
    updateSelectedDisplay();
    if (categoryField) {
      categoryField.value = selectedCategory || '';
    }
    if (cancelBtn) cancelBtn.style.display = 'inline-block';
  });

  // Handle allergen change
  allergenSelect.addEventListener('change', function() {
    selectedAllergen = this.value;
    const selectedOption = this.options[this.selectedIndex];
    const optionCategory = selectedOption && selectedOption.dataset ? selectedOption.dataset.category : '';

    if (optionCategory) {
      selectedCategory = optionCategory;
      if (categorySelect) {
        categorySelect.value = optionCategory;
      }
    }
    
    // Auto-populate reactions if allergen is selected
    if (selectedAllergen && selectedCategory && ALLERGY_DATA[selectedCategory][selectedAllergen]) {
      const suggestedReactions = ALLERGY_DATA[selectedCategory][selectedAllergen].split(', ');
      
      // Check relevant reaction checkboxes
      const checkboxes = reactionsContainer.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(checkbox => {
        const isSuggested = suggestedReactions.some(suggested => 
          checkbox.value.toLowerCase().includes(suggested.toLowerCase()) ||
          suggested.toLowerCase().includes(checkbox.value.toLowerCase())
        );
        if (isSuggested) {
          checkbox.checked = true;
          if (!selectedReactions.includes(checkbox.value)) {
            selectedReactions.push(checkbox.value);
          }
        }
      });
    }
    
    updateSelectedDisplay();
    if (categoryField) {
      categoryField.value = selectedCategory || '';
    }
    if (cancelBtn) cancelBtn.style.display = 'inline-block';
  });

  // Handle reaction checkbox changes
  reactionsContainer.addEventListener('change', function(e) {
    if (e.target.type === 'checkbox') {
      const reaction = e.target.value;
      if (e.target.checked) {
        if (!selectedReactions.includes(reaction)) {
          selectedReactions.push(reaction);
        }
      } else {
        selectedReactions = selectedReactions.filter(r => r !== reaction);
      }
      updateSelectedDisplay();
    }
  });

  // Handle severity selection
  severitySelect.addEventListener('change', function() {
    selectedSeverity = this.value;
    updateSelectedDisplay();
  });

  // Handle manual input changes
  manualAllergenInput.addEventListener('input', function() {
    if (this.value.trim()) {
      selectedAllergen = this.value.trim();
      selectedCategory = 'Manual Entry';
      categorySelect.value = '';
      allergenSelect.innerHTML = '<option value="">Manual entry selected</option>';
      updateSelectedDisplay();
      if (categoryField) {
        categoryField.value = selectedCategory;
      }
      if (cancelBtn) cancelBtn.style.display = 'inline-block';
    }
  });

  manualReactionInput.addEventListener('input', function() {
    const manualReaction = this.value.trim();
    if (manualReaction && !selectedReactions.includes(manualReaction)) {
      // Remove any existing manual reaction
      selectedReactions = selectedReactions.filter(r => !r.includes('Manual: '));
      selectedReactions.push(`Manual: ${manualReaction}`);
      updateSelectedDisplay();
    }
  });

  // Update selected display
  function updateSelectedDisplay() {
    const parts = [];
    
    if (selectedCategory && selectedCategory !== 'Manual Entry') {
      parts.push(`<strong>Category:</strong> ${selectedCategory}`);
    }
    
    if (selectedAllergen) {
      parts.push(`<strong>Allergen:</strong> ${selectedAllergen}`);
    }
    
    if (selectedReactions.length > 0) {
      parts.push(`<strong>Reactions:</strong> ${selectedReactions.join(', ')}`);
    }
    
    if (selectedSeverity) {
      parts.push(`<strong>Severity:</strong> ${selectedSeverity}`);
    }
    
    if (parts.length > 0) {
      selectedDisplay.innerHTML = parts.join('<br>');
    } else {
      selectedDisplay.innerHTML = '<em style="color: #666;">No selection made</em>';
    }
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', function() {
      const container = document.getElementById(containerId);
      if (container) {
        container.style.display = 'none';
      }
      const showAllergyBtn = document.getElementById('show-allergy-form-btn');
      if (showAllergyBtn) {
        showAllergyBtn.style.display = 'inline-block';
      }
      cancelBtn.style.display = 'none';
    });
  }

  // Clear selection
  clearBtn.addEventListener('click', function() {
    selectedCategory = '';
    selectedAllergen = '';
    selectedReactions = [];
    selectedSeverity = '';
    
    categorySelect.value = '';
    allergenSelect.innerHTML = '<option value="">Select an allergen...</option>';
    severitySelect.value = '';
    manualAllergenInput.value = '';
    manualReactionInput.value = '';
    notesInput.value = '';
    if (categoryField) categoryField.value = '';
    
    // Uncheck all reaction checkboxes
    const checkboxes = reactionsContainer.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => checkbox.checked = false);
    
    // Also clear the form input fields
    const allergenField = document.getElementById(allergenFieldId);
    const reactionField = document.getElementById(reactionFieldId);
    const severityField = document.getElementById(containerId.includes('clinical-note') ? 'note-severity' : 'severity');
    const notesField = document.getElementById(containerId.includes('clinical-note') ? 'note-allergy-notes' : 'allergy-notes');
    
    if (allergenField) allergenField.value = '';
    if (reactionField) reactionField.value = '';
    if (severityField) severityField.value = '';
    if (notesField) notesField.value = '';
    
    updateSelectedDisplay();
    console.log('Allergy selector and form fields cleared');
  });

  // Apply selection
  if (applyBtn) {
    applyBtn.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('Apply button clicked!');
      console.log('Selected allergen:', selectedAllergen);
      console.log('Selected reactions:', selectedReactions);
      
      // Check if we have valid selections
      if (!selectedAllergen && selectedReactions.length === 0) {
        alert('Please select an allergen and/or reactions before applying.');
        return;
      }
      
      if (!selectedSeverity) {
        alert('Please select a severity level before applying.');
        return;
      }
      
      const allergenField = document.getElementById(allergenFieldId);
      const reactionField = document.getElementById(reactionFieldId);
      
      console.log('Target fields:', {
        allergenField: allergenField,
        reactionField: reactionField,
        allergenFieldId: allergenFieldId,
        reactionFieldId: reactionFieldId
      });
      
      // Populate the input fields
      if (allergenField && selectedAllergen) {
        allergenField.value = selectedAllergen;
        console.log('Allergen field updated to:', selectedAllergen);
      }
      if (categoryField) {
        categoryField.value = selectedCategory || (selectedAllergen ? 'Manual Entry' : '');
      }
      
      if (reactionField && selectedReactions.length > 0) {
        reactionField.value = selectedReactions.join(', ');
        console.log('Reaction field updated to:', selectedReactions.join(', '));
      }
      
      // Set severity from user selection
      const severityField = document.getElementById(containerId.includes('clinical-note') ? 'note-severity' : 'severity');
      if (severityField && selectedSeverity) {
        severityField.value = selectedSeverity;
        console.log('Severity set to:', selectedSeverity);
      }
      
      // Set notes from user input
      const notesField = document.getElementById(containerId.includes('clinical-note') ? 'note-allergy-notes' : 'allergy-notes');
      if (notesField && notesInput) {
        notesField.value = notesInput.value;
        console.log('Notes set to:', notesInput.value);
      }
      
      // Trigger change events to update the form
      if (allergenField) {
        allergenField.dispatchEvent(new Event('change'));
        allergenField.dispatchEvent(new Event('input'));
      }
      if (reactionField) {
        reactionField.dispatchEvent(new Event('change'));
        reactionField.dispatchEvent(new Event('input'));
      }
      if (severityField) {
        severityField.dispatchEvent(new Event('change'));
        severityField.dispatchEvent(new Event('input'));
      }
      if (notesField) {
        notesField.dispatchEvent(new Event('change'));
        notesField.dispatchEvent(new Event('input'));
      }
      
      // Automatically add the allergy to the table
      setTimeout(() => {
        console.log('Attempting to add allergy to table...');
        
        // Determine which add function to call based on the page/container
        if (containerId.includes('clinical-note')) {
          console.log('Calling addNoteAllergy for clinical note');
          if (typeof window.addNoteAllergy === 'function') {
            window.addNoteAllergy();
          } else {
            console.error('addNoteAllergy function not found');
          }
        } else if (document.getElementById('add-patient-form') || document.getElementById('patient-intake-form')) {
          // Add-patient or intake form share the same entry helper
          console.log('Calling addAllergyEntry for patient intake/add-patient page');
          if (typeof window.addAllergyEntry === 'function') {
            window.addAllergyEntry();
          } else {
            console.error('addAllergyEntry function not found');
          }
        } else {
          console.log('Calling addAllergy for patient details');
          if (typeof window.addAllergy === 'function') {
            window.addAllergy();
          } else {
            console.error('addAllergy function not found');
          }
        }
      }, 100); // Small delay to ensure fields are updated
      
      console.log('Allergy selection applied successfully!');
      
      // Show visual feedback
      applyBtn.style.backgroundColor = '#28a745';
      applyBtn.textContent = '✓ Applied';
      setTimeout(() => {
        applyBtn.style.backgroundColor = '#007bff';
        applyBtn.textContent = 'Add to Allergies Table';
      }, 2000);
    });
  } else {
    console.error('Apply button not found!');
  }

  // Initialize reactions
  populateCommonReactions();
  populateAllergenDropdown('');
  updateSelectedDisplay();
}

// Initialize allergy selectors when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, initializing allergy selectors...');
  
  // Initialize for patient-details.html - BUT ONLY if container is visible or if there's no show button
  // If show-allergy-form-btn exists, it means the form should be hidden by default and only shown on button click
  const patientDetailsContainer = document.getElementById('allergy-selector-container');
  const showButton = document.getElementById('show-allergy-form-btn');
  
  if (patientDetailsContainer && !showButton) {
    // Only auto-initialize if there's no show button (for pages like add-patient.html)
    console.log('Found patient-details allergy container without show button, creating selector...');
    createAllergySelector('allergy-selector-container', 'allergen', 'reaction');
  } else if (patientDetailsContainer && showButton) {
    // For patient-details.html with show button, DO NOT auto-initialize - wait for user to click Add
    console.log('Found patient-details allergy container with show button - will initialize when Add button is clicked');
  } else {
    console.log('Patient-details allergy container not found');
  }
  
  // Initialize for clinical-note.html (if it exists)
  if (document.getElementById('clinical-note-allergy-selector-container')) {
    console.log('Found clinical-note allergy container, creating selector...');
    createAllergySelector('clinical-note-allergy-selector-container', 'note-allergen', 'note-reaction');
  } else {
    console.log('Clinical-note allergy container not found');
  }
});

// Also try to initialize after a delay in case DOM is not fully ready
setTimeout(function() {
  console.log('Delayed initialization of allergy selectors...');
  
  // Initialize for patient-details.html - BUT ONLY if there's no show button
  const patientDetailsContainer = document.getElementById('allergy-selector-container');
  const showButton = document.getElementById('show-allergy-form-btn');
  
  if (patientDetailsContainer && !showButton && !document.getElementById('allergy-selector-container-category')) {
    // Only auto-initialize if there's no show button (for pages like add-patient.html)
    console.log('Delayed: Found patient-details allergy container without show button, creating selector...');
    createAllergySelector('allergy-selector-container', 'allergen', 'reaction');
  } else if (patientDetailsContainer && showButton) {
    // For patient-details.html with show button, DO NOT auto-initialize
    console.log('Delayed: Found patient-details allergy container with show button - will initialize when Add button is clicked');
  }
  
  // Initialize for clinical-note.html (if it exists)
  if (document.getElementById('clinical-note-allergy-selector-container') && !document.getElementById('clinical-note-allergy-selector-container-category')) {
    console.log('Delayed: Found clinical-note allergy container, creating selector...');
    createAllergySelector('clinical-note-allergy-selector-container', 'note-allergen', 'note-reaction');
  }
}, 1000);
