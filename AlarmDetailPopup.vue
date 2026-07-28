<!-- 
===============================================
  ● 파일명: AlarmDetailPopup.vue
  ● 설  명: ACS - 기준정보 - 알람 기준정보 상세 정보
  ● 작성자: 이희원
  ● 작성일: 2025-09-02
===============================================
-->
<template>
  <component-panel
    :title="props.title"
    :use-expand-btn="false"
    use-footer
    class="b-modal-popup"
  >
    <div class="inner-modal-content drag">
      <div class="form-option">

        <!-- Unit Model -->
        <div class="option-item">
          <span class="item-label">{{ 'Unit Model' }}<sup>*</sup></span>
          <span class="item-input">
            <b-field>
              <b-input 
                v-model="inputForm.unitModel"
              />
            </b-field>
          </span>
        </div>

        <!-- Alarm ID -->
        <div class="option-item">
          <span class="item-label">{{ 'Alarm ID' }}<sup>*</sup></span>
          <span class="item-input">
            <b-field>
              <b-input 
                v-model="inputForm.alarmId"
                :readonly="!!props.data?.alarmId"
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                maxlength="6"
                :has-counter="false"
                @input="(e) => inputForm.alarmId = e.target.value.replace(/\D/g, '').slice(0, 6)"
              />
            </b-field>
          </span>
        </div>
          <!-- 위에 태그에서 뺀거: disabled="inputForm.seq !== null && inputForm.seq !== ''" -->

        <!-- Alarm Group -->
        <div class="option-item">
          <span class="item-label">{{ 'Alarm Group' }}</span>
          <span class="item-input">
            <b-field>
              <b-input 
                v-model="inputForm.alarmGroup" 
              />
            </b-field>
          </span>
        </div>

        <!-- Vendor -->
        <div class="option-item">
          <span class="item-label">{{ 'Vendor' }}</span>
          <span class="item-input">
            <b-field>
              <b-input 
                v-model="inputForm.vendor" 
              />
            </b-field>
          </span>
        </div>

        <!-- Alarm Level -->
        <div class="option-item">
          <span class="item-label">{{ 'Alarm Level' }}</span>
          <span class="item-input">
            <b-field>
              <b-select v-model="inputForm.alarmLevel">
                <option v-for="item in alarmLevelList" :key="item.value" :value="item.value">
                  {{ item.label }}
                </option>
              </b-select>
            </b-field>
          </span>
        </div>

        <!-- Alarm Code -->
        <div class="option-item">
          <span class="item-label">{{ 'Alarm Code' }}<sup>*</sup></span>
          <span class="item-input">
            <b-field>
              <b-input 
                v-model="inputForm.alarmCode"
                :disabled="inputForm.seq !== null && inputForm.seq !== ''"
              />
            </b-field>
          </span>
        </div>

        <!-- Alarm Text_ko -->
        <div class="option-item">
          <span class="item-label">{{ 'Alarm Text_ko' }}</span>
          <span class="item-input">
            <b-field>
              <b-input 
                v-model="inputForm.text1" 
              />
            </b-field>
          </span>
        </div>

        <!-- Alarm Cause_ko -->
        <div class="option-item">
          <span class="item-label">{{ 'Alarm Cause_ko' }}</span>
          <span class="item-input">
            <b-field>
              <b-input 
                v-model="inputForm.cause1" 
              />
            </b-field>
          </span>
        </div>

        <!-- Alarm Action_ko -->
        <div class="option-item">
          <span class="item-label">{{ 'Alarm Action_ko' }}</span>
          <span class="item-input">
            <b-field>
              <b-input 
                v-model="inputForm.action1" 
              />
            </b-field>
          </span>
        </div>

        <!-- Alarm Text_en -->
        <div class="option-item">
          <span class="item-label">{{ 'Alarm Text_en' }}</span>
          <span class="item-input">
            <b-field>
              <b-input 
                v-model="inputForm.text2" 
              />
            </b-field>
          </span>
        </div>
        
        <!-- Alarm Cause_en -->
        <div class="option-item">
          <span class="item-label">{{ 'Alarm Cause_en' }}</span>
          <span class="item-input">
            <b-field>
              <b-input 
                v-model="inputForm.cause2" 
              />
            </b-field>
          </span>
        </div>


        <!-- Alarm Action_en -->
        <div class="option-item">
          <span class="item-label">{{ 'Alarm Action_en' }}</span>
          <span class="item-input">
            <b-field>
              <b-input 
                v-model="inputForm.action2" 
              />
            </b-field>
          </span>
        </div>

        <!-- Alarm Text_etc -->
        <div class="option-item">
          <span class="item-label">{{ 'Alarm Text_etc' }}</span>
          <span class="item-input">
            <b-field>
              <b-input 
                v-model="inputForm.text3" 
              />
            </b-field>
          </span>
        </div>

        <!-- Alarm Cause_etc -->
        <div class="option-item">
          <span class="item-label">{{ 'Alarm Cause_etc' }}</span>
          <span class="item-input">
            <b-field>
              <b-input 
                v-model="inputForm.cause3" 
              />
            </b-field>
          </span>
        </div>

        <!-- Alarm Action_etc -->
        <div class="option-item">
          <span class="item-label">{{ 'Alarm Action_etc' }}</span>
          <span class="item-input">
            <b-field>
              <b-input 
                v-model="inputForm.action3" 
              />
            </b-field>
          </span>
        </div>

        <!-- ENABLE -->
        <div class="option-item">
          <span class="item-label">{{ 'Enable' }}</span>
          <span class="item-input">
            <b-field>
              <b-select v-model="inputForm.benable">
                <option v-for="item in enableList" :key="item.value" :value="item.value">
                  {{ item.label }}
                </option>
              </b-select>
            </b-field>
          </span>
        </div>

        <!-- Human Error -->
        <div class="option-item">
          <span class="item-label">{{ 'Human Error' }}</span>
          <span class="item-input">
            <b-field>
              <b-select v-model="inputForm.humanError">
                <option v-for="item in humanErrorList" :key="item.value" :value="item.value">
                  {{ item.label }}
                </option>
              </b-select>
            </b-field>
          </span>
        </div>

      </div>

      <slot name="content" />
    </div>
    <template #footer>
      <slot name="footer" />
      <b-button
        v-if="!isAcsOperator"
        type="is-primary"
        icon-left="content-save"
        :label="isEditMode ? $t('ACS-BUTTON-EDIT') : $t('LABEL-STND_REGI')"
        @click="onSave"
      />
      <b-button
        type="is-dark"
        icon-left="close"
        :label="$t('BUTTON-CLOSE')"
        @click="emit('close')"
      />
    </template>
  </component-panel>
</template>

<script setup>
import { ref, reactive, watch, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import API from '@/views/Apis'
import { stores } from '@ifacts/ui-core'
import { DialogProgrammatic } from 'buefy'
import { useMonitoringStore } from '@/stores/monitoring/monitoringStore'
import { getCommonCodeList } from '@/utils/commonCodeUtils'

const $t = useI18n().t

const authStore = stores.useAuthStore()
const monitoringStore = useMonitoringStore()

// 관리자 확인 플래그
const isAcsManager = authStore.user?.userGrps?.some(grp => grp.grpCode === 'ACS_MANAGER')
const isAcsOperator = authStore.user?.userGrps?.some(grp => grp.grpCode === 'ACS_OPERATOR')

const props = defineProps({
  title: { type: String, default: '' },
  data: { type: Object, required: false }
})

const emit = defineEmits(['close', 'save']) 

// Input Form 모델
const inputForm = reactive({
  seq: null,
  unitModel: '',
  alarmId: '',
  alarmGroup: '',
  vendor: '',
  alarmKind: '',
  alarmLevel: '',
  type1: '',
  type1Level1: '',
  type2: '',
  type2Level1: '',
  alarmCode: '',
  text1: '',
  cause1: '',
  action1: '',
  text2: '',
  cause2: '',
  action2: '',
  text3: '',
  cause3: '',
  action3: '',
  benable: '',
  humanError: ''
})

// Alarm Level 선택 목록
const alarmLevelList = ref([])

// Enable 선택 목록
const enableList = reactive([
  { label: 'Y', value: 'Y' },
  { label: 'N', value: 'N' }
])

// humanError 선택 목록
const humanErrorList = reactive([
  { label: 'Y', value: 'Y' },
  { label: 'N', value: 'N' }
])

// 선택한 그리드 데이터 바인딩
watch(() => props.data, (newVal) => {
  if (newVal) {
    for (let key in newVal) {
      if (key in inputForm) {
        inputForm[key] = JSON.parse(JSON.stringify(newVal[key]))
      }
    }
  }
}, { immediate: true })

const isEditMode = computed(() => {
  return props.title === $t('ACS-MESSAGE-ALARM_TITLE_EDIT')
})

// 저장
const onSave = async () => {

  // 신규 등록 여부 판단
  const isCreateMode =
    inputForm.seq === null ||
    inputForm.seq === undefined ||
    inputForm.seq === ''

  // 신규 등록일 때만 체크
  if (isCreateMode) {

    // unit_model 필수 체크
    if (
      inputForm.unitModel === null ||
      inputForm.unitModel === undefined ||
      String(inputForm.unitModel).trim() === ''
    ) {
      await new Promise(resolve => {
        new DialogProgrammatic().alert(
          'Unit Model is required.',
          { onClose: resolve }
        )
      })
      return
    }

    // alarm_id 필수 체크
    if (
      inputForm.alarmId === null ||
      inputForm.alarmId === undefined ||
      inputForm.alarmId === ''
    ) {
      await new Promise(resolve => {
        new DialogProgrammatic().alert(
          $t('ACS-MESSAGE-ALARM_VAL_ID'),
          { onClose: resolve }
        )
      })
      return
    }

    // alarm_code 필수 체크
    if (
      !inputForm.alarmCode ||
      String(inputForm.alarmCode).trim() === ''
    ) {
      await new Promise(resolve => {
        new DialogProgrammatic().alert(
          $t('ACS-MESSAGE-ALARM_VAL_CODE'),
          { onClose: resolve }
        )
      })
      return
    }
  }

  // 저장 확인
  const confirmed = await new Promise(resolve => {
    new DialogProgrammatic().confirm({
      message: $t('MESSAGE-M009'),
      cancelText: $t('BUTTON-CANCEL'),
      confirmText: $t('BUTTON-CONFIRM'),
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false)
    })
  })

  if (!confirmed) return

  try {

    // 신규 등록일 때만 중복 체크: 먼저 Unit Model, sau đó Alarm ID (riêng biệt)
    if (isCreateMode) {
      // Unit Model 중복 체크
      const unitCheck = await API.AcsApi.getAlarmDuplicateCheck({ unitModel: inputForm.unitModel })

      if (unitCheck.status !== 200) {
        await new Promise(resolve => {
          new DialogProgrammatic().alert(
            $t('ACS-MESSAGE-ALARM_ERR_DUP_CHECK'),
            { onClose: resolve }
          )
        })
        return
      }

      if (unitCheck.data === true) {
        await new Promise(resolve => {
          new DialogProgrammatic().alert(
            'Unit Model already exists.',
            { onClose: resolve }
          )
        })
        return
      }

      // Alarm ID 중복 체크
      const idCheck = await API.AcsApi.getAlarmDuplicateCheck({ alarmId: inputForm.alarmId })

      if (idCheck.status !== 200) {
        await new Promise(resolve => {
          new DialogProgrammatic().alert(
            $t('ACS-MESSAGE-ALARM_ERR_DUP_CHECK'),
            { onClose: resolve }
          )
        })
        return
      }

      if (idCheck.data === true) {
        await new Promise(resolve => {
          new DialogProgrammatic().alert(
            'Alarm ID already exists.',
            { onClose: resolve }
          )
        })
        return
      }
    }

    // 저장
    const rslt = await API.AcsApi.saveAlarmStandard([inputForm])

    if (rslt.status === 200) {
      onSearchAlarmStandard()

      emit('save')
      emit('close')

      await new Promise(resolve => {
        new DialogProgrammatic().alert(
          $t('MESSAGE-IAM002'),
          { onClose: resolve }
        )
      })
    } else {
      await new Promise(resolve => {
        new DialogProgrammatic().alert(
          $t('MESSAGE-IAM005'),
          { onClose: resolve }
        )
      })
    }

  } catch (err) {
    console.error(err)
    await new Promise(resolve => {
      new DialogProgrammatic().alert(
        $t('ACS-MESSAGE-ALARM_ERR_DUP'),
        { onClose: resolve }
      )
    })
  }
}

// 알람 기준정보 조회
const onSearchAlarmStandard = async () => {
  try {
    const res = await API.AcsApi.getAlarmStandard({})

    monitoringStore.alarmStndData = [...res.data.content]
  } catch (err) {
    console.error(err)
  }
}

// 알람 레벨 시스템 코드 호출
const onSetAlarmLevelCode = async () => {
  alarmLevelList.value = await getCommonCodeList('Alarm-Level').then((res) => {
    return res.map((item) => ({
      label: `${item.name}`,
      value: item.code
    }))
  })
}

// 초기 알람 레벨 시스템 코드 호출
onMounted(() => {
  onSetAlarmLevelCode()
})
</script>

<style lang="scss" scoped>
  .component-panel.b-modal-popup :deep(> .panel-header) {
  height: 40px !important;
  min-height:auto;
  .header-title {
    font-size: 1.2rem !important;
  }
}
.form-option {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;

  .option-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 8px;

    .item-label {
      flex: 0 0 40%;      /* 왼쪽 50% */
      text-align: left;

      sup {
        color: red;
      }
    }

    .item-input {
      flex: 0 0 57%;      /* 오른쪽 50% */
      display: flex;
      align-items: center;

      width: 100%;        /* li 기준으로 절반 영역 채움 */
      
      /* 인풋 박스를 꽉 채움 */
      :deep(.input),
      :deep(.select),
      :deep(.field),

      :deep(input) {
        width: 100%;
      }

      :deep(select) {
        width: 100%;
      }

      .unit {
        margin-left: 5px;
      }
    }
  }
}

hr {
  width: 100%;
  height: 0.1px;
  background-color: #e2e2e2;
  border: none;
  margin: 0;
  padding: 0;
}

.b-modal-popup {
  width: 100%;
  height: 100%;
  max-width:400px !important;
}

// panel header
:deep(.panel-header .header-title){
    padding-left:0 !important;
    &:after{
      display:none !important;
    }
}

@media (max-width:1920px) {
    // 팝업 헤더 조정
  .component-panel.b-modal-popup :deep(> .panel-header) {
    height: 36px !important;
    .header-title{
      font-size: 1.1rem !important;
    }
  }
  .form-option{
    gap:5px;
  }
  .b-modal-popup {
    max-width:350px;
  }

}

@media (max-width:1700px){
  .form-option{
    .option-item{
      .item-label{
        font-size:11px;
      }
      .item-input{
        .field {
          .control{
            font-size:11px;
            :deep(.input){
              font-size:11px;
            }
          }
        }
      }
    }
  }
}
</style>